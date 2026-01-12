import type { AIFillResult, FormAnalysis, ApiKeyEntry, PromptTemplate } from '@/shared/types';
import { OPENROUTER_API_URL, AVAILABLE_MODELS } from '@/shared/constants';
import { logger } from '@/utils/logger';

interface OpenRouterMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Streaming chunk from SSE
interface StreamChunk {
  choices: Array<{
    delta: {
      content?: string;
    };
  }>;
}

// Callback for streaming updates
export type StreamCallback = (chunk: string, fullText: string) => void;

// Global abort controller for cancellation
let currentAbortController: AbortController | null = null;

// Track failed API keys in current session (reset on success)
const failedApiKeys = new Set<string>();

/**
 * Check if a model supports vision/image input
 * @param modelId The model ID to check
 * @returns true if model supports vision, false otherwise (defaults to false for unknown models)
 */
function modelSupportsVision(modelId: string): boolean {
  const model = AVAILABLE_MODELS.find((m) => m.id === modelId && m.provider === 'openrouter');
  // For known models, use the supportsVision flag
  // For custom/unknown models, assume they DON'T support vision to be safe
  return model?.supportsVision ?? false;
}

/**
 * Cancel any running AI request
 */
export function cancelAIRequest(): boolean {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
    logger.log('AI request cancelled');
    return true;
  }
  return false;
}

/**
 * Get the next available API key (primary first, then fallbacks)
 * @param settings Extension settings
 * @param excludeKeys Set of keys to exclude (e.g., already failed with 429)
 */
function getNextApiKey(
  apiKey: string,
  apiKeys: ApiKeyEntry[] = [],
  primaryApiKeyId?: string,
  excludeKeys: Set<string> = new Set()
): string | null {
  // Build ordered list of keys: primary first, then by addedAt
  const orderedKeys: string[] = [];

  // Add primary key first (backward compatible)
  if (apiKey && !excludeKeys.has(apiKey)) {
    orderedKeys.push(apiKey);
  }

  // Add keys from apiKeys array, primary first if set
  const sortedApiKeys = [...apiKeys].sort((a, b) => {
    if (a.id === primaryApiKeyId) return -1;
    if (b.id === primaryApiKeyId) return 1;
    return a.addedAt - b.addedAt;
  });

  for (const entry of sortedApiKeys) {
    if (!excludeKeys.has(entry.key) && !orderedKeys.includes(entry.key)) {
      orderedKeys.push(entry.key);
    }
  }

  return orderedKeys.length > 0 ? orderedKeys[0] : null;
}

/**
 * Analyze form using OpenRouter API
 * Includes retry logic for failed JSON parsing and 429 fallback
 */
export async function analyzeFormWithOpenRouter(
  formAnalysis: FormAnalysis,
  apiKey: string,
  apiKeys: ApiKeyEntry[],
  primaryApiKeyId: string | undefined,
  model: string,
  activeTemplate?: PromptTemplate,
  debugMode: boolean = false,
  maxRetries: number = 3,
  onStream?: StreamCallback
): Promise<AIFillResult> {
  // Get active API key
  let currentKey = getNextApiKey(apiKey, apiKeys, primaryApiKeyId, failedApiKeys);

  if (!currentKey) {
    throw new Error('No API keys available. All keys may have hit rate limits.');
  }

  // Create new abort controller for this request
  currentAbortController = new AbortController();
  const signal = currentAbortController.signal;

  let lastError: Error | null = null;

  try {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // Check if cancelled
      if (signal.aborted) {
        throw new Error('Request cancelled');
      }

      try {
        const prompt = activeTemplate
          ? buildCustomPrompt(formAnalysis, activeTemplate, attempt > 1)
          : buildAnalysisPrompt(formAnalysis, attempt > 1);

        // Only include screenshot if model supports vision
        const supportsVision = modelSupportsVision(model);
        const screenshotToUse = supportsVision ? formAnalysis.screenshot : undefined;

        if (!supportsVision && formAnalysis.screenshot) {
          logger.log(`Model ${model} does not support vision, skipping screenshot`);
        }

        const messages = buildMessages(prompt, screenshotToUse);

        logger.log(`Attempt ${attempt}/${maxRetries}: Using model ${model}`);

        // Use streaming if debug mode is enabled and callback is provided
        const useStreaming = debugMode && onStream;

        let response: OpenRouterResponse;
        if (useStreaming) {
          response = await callOpenRouterStreaming(
            {
              model: model,
              messages,
              temperature: attempt === 1 ? 0.3 : 0.1,
              stream: true,
            },
            currentKey,
            onStream,
            signal
          );
        } else {
          response = await callOpenRouter({
            model: model,
            messages,
            temperature: attempt === 1 ? 0.3 : 0.1,
          }, currentKey, signal);
        }

        const result = parseAIResponse(response);

        // Verify we got some fields
        if (Object.keys(result).length === 0) {
          throw new Error('AI returned empty result');
        }

        // Success - clear failed keys for this session
        failedApiKeys.clear();

        logger.log(`Successfully parsed ${Object.keys(result).length} fields on attempt ${attempt}`);
        return result;
      } catch (error) {
        // Re-throw cancellation errors immediately
        if (signal.aborted) {
          throw new Error('Request cancelled');
        }

        const errorMessage = error instanceof Error ? error.message : String(error);

        // Handle 429 rate limit - try next API key
        if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
          logger.warn(`Rate limit hit for key ending ...${currentKey.slice(-4)}, trying fallback`);
          failedApiKeys.add(currentKey);

          const nextKey = getNextApiKey(apiKey, apiKeys, primaryApiKeyId, failedApiKeys);
          if (nextKey) {
            currentKey = nextKey;
            logger.log(`Switching to fallback key ending ...${currentKey.slice(-4)}`);
            continue; // Retry with new key
          }
        }

        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn(`Attempt ${attempt} failed:`, lastError.message);

        if (attempt < maxRetries) {
          // Wait before retry with exponential backoff
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    throw lastError || new Error('Failed to analyze form after retries');
  } finally {
    currentAbortController = null;
  }
}

/**
 * Build custom prompt from user template
 */
function buildCustomPrompt(formAnalysis: FormAnalysis, template: PromptTemplate, isRetry: boolean = false): string {
  const fieldsSummary = formAnalysis.fields.map((field) => ({
    id: field.id,
    label: field.label,
    type: field.type,
    required: field.required,
    options: field.options,
    currentValue: field.currentValue || '(empty)',
    fillMethod: field.fillMethod,
    isDisabled: field.isDisabled,
    isReadOnly: field.isReadOnly,
  }));

  // Replace template variables
  let prompt = template.prompt
    .replace('{{URL}}', formAnalysis.url)
    .replace('{{FIELDS}}', JSON.stringify(fieldsSummary, null, 2));

  // Add retry warning if needed
  if (isRetry) {
    prompt += `\n\n## ⚠️ RETRY: Your previous response failed to parse. Return ONLY valid JSON.`;
  }

  return prompt;
}

/**
 * Build the analysis prompt based on detected fields
 */
function buildAnalysisPrompt(formAnalysis: FormAnalysis, isRetry: boolean = false): string {
  const fieldsSummary = formAnalysis.fields.map((field) => ({
    id: field.id,
    label: field.label,
    type: field.type,
    required: field.required,
    options: field.options,
    currentValue: field.currentValue || '(empty)',
    fillMethod: field.fillMethod,
    isDisabled: field.isDisabled,
    isReadOnly: field.isReadOnly,
  }));

  // Stricter JSON-only instructions for retry attempts
  const strictJsonWarning = isRetry
    ? `
## ⚠️ CRITICAL: JSON ONLY - PREVIOUS ATTEMPT FAILED
Your previous response could not be parsed. You MUST return ONLY a valid JSON object.
- NO explanations, NO markdown, NO code blocks
- Start with { and end with }
- NO trailing commas
- ALL string values must be properly quoted
- Example: {"field1": "value1", "field2": "value2"}
`
    : '';

  const jsonFormatInstructions = isRetry
    ? `Return ONLY the raw JSON object. No markdown, no code blocks, no explanations.
Start your response with { and end with }`
    : `Return ONLY valid JSON in this format:

\`\`\`json
{
  "fieldId1": "value1",
  "fieldId2": "value2"
}
\`\`\``;

  return `You are a form-filling assistant for testing purposes. Analyze the form screenshot and DOM structure below.

## IMPORTANT: Generate RANDOM and REALISTIC Data
- Generate DIFFERENT random values each time - never repeat the same data
- Make values look like REAL production data, not obvious test data
- Randomize names, numbers, dates, and all values naturally
- For Korean data: use realistic Korean names, addresses, phone numbers, business names
${strictJsonWarning}
## Form URL
${formAnalysis.url}

## Detected Form Fields (from DOM)
\`\`\`json
${JSON.stringify(fieldsSummary, null, 2)}
\`\`\`

## Instructions
1. Look at the screenshot to understand the form context
2. For each field, generate a RANDOM and REALISTIC test value
3. Use Korean values where appropriate (this is a Korean business app)
4. For required fields, always provide a value
5. For select fields, choose from the available options if provided
6. **SKIP these fields (do not include in response)**:
   - Fields with fillMethod: "skip" (disabled)
   - Fields with fillMethod: "computed" (auto-generated)
   - Fields with fillMethod: "file" (file uploads)
   - Fields with isDisabled: true
7. For popup fields (fillMethod: "popup"), provide a category path or selection value
8. For richtext fields, provide HTML content or plain text
9. ${jsonFormatInstructions}

## Guidelines for RANDOM Realistic Values
- Business name: Random Korean company names (e.g., "삼성전자", "현대모비스", "롯데마트", "신세계", "네이버", "카카오") - pick randomly
- Person name: Random Korean names (e.g., "김철수", "이영희", "박지민", "최수연", "정민호") - generate different each time
- Phone: Korean format with random numbers (e.g., "010-XXXX-XXXX" where X is random digit)
- Email: Random realistic emails combining names and domains (e.g., "user123@gmail.com", "sales@company.co.kr")
- Address: Random Korean addresses (vary city, district, street)
- Dates: Random dates within reasonable ranges (YYYY-MM-DD format)
- Numbers: Random values within appropriate ranges for the field type
- Prices: Random amounts that look realistic (e.g., 15000, 89000, 125000)
- Categories: Pick randomly from common category paths
- Rich text: Generate varied product descriptions, not repetitive text

${isRetry ? 'OUTPUT JSON ONLY. NO OTHER TEXT.' : 'Return ONLY the JSON object, no other text.'}`;
}

/**
 * Build OpenRouter message array
 */
function buildMessages(prompt: string, screenshot?: string): OpenRouterMessage[] {
  const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
    { type: 'text', text: prompt },
  ];

  if (screenshot) {
    const imageUrl = screenshot.startsWith('data:')
      ? screenshot
      : `data:image/png;base64,${screenshot}`;

    content.push({
      type: 'image_url',
      image_url: { url: imageUrl },
    });
  }

  return [{ role: 'user', content }];
}

/**
 * Call OpenRouter API
 */
async function callOpenRouter(request: OpenRouterRequest, apiKey: string, signal?: AbortSignal): Promise<OpenRouterResponse> {
  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://daun.kr',
      'X-Title': 'Daun Auto-Fill Extension',
    },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('OpenRouter API error:', response.status, errorText);

    if (response.status === 401) {
      throw new Error('Invalid API key. Please check your OpenRouter API key.');
    }
    if (response.status === 429) {
      throw new Error('429 Rate limit exceeded.');
    }
    if (response.status === 402) {
      throw new Error('Insufficient credits. Please add credits to your OpenRouter account.');
    }
    if (response.status === 404) {
      throw new Error(`Model not found: ${request.model}. Try selecting a different model.`);
    }

    // Try to parse error details
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.error?.message) {
        throw new Error(`API error: ${errorJson.error.message}`);
      }
    } catch {
      // If not JSON, use status code
    }

    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();

  if (data.usage) {
    logger.log('Token usage:', data.usage);
  }

  return data as OpenRouterResponse;
}

/**
 * Call OpenRouter API with streaming (SSE)
 * Returns complete response after streaming finishes
 */
async function callOpenRouterStreaming(
  request: OpenRouterRequest,
  apiKey: string,
  onStream: StreamCallback,
  signal?: AbortSignal
): Promise<OpenRouterResponse> {
  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://daun.kr',
      'X-Title': 'Daun Auto-Fill Extension',
    },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('OpenRouter streaming API error:', response.status, errorText);
    if (response.status === 429) {
      throw new Error('429 Rate limit exceeded.');
    }
    throw new Error(`API error: ${response.status}`);
  }

  if (!response.body) {
    throw new Error('No response body for streaming');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const data = trimmed.slice(6); // Remove 'data: ' prefix

        if (data === '[DONE]') {
          logger.log('Streaming complete');
          continue;
        }

        try {
          const chunk: StreamChunk = JSON.parse(data);
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            fullContent += content;
            onStream(content, fullContent);
          }
        } catch {
          // Skip malformed chunks
          logger.warn('Failed to parse SSE chunk:', data);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  logger.log('Streaming finished, total length:', fullContent.length);

  // Return in standard OpenRouterResponse format
  return {
    choices: [
      {
        message: {
          content: fullContent,
        },
      },
    ],
  };
}

/**
 * Parse AI response to extract field values
 */
function parseAIResponse(response: OpenRouterResponse): AIFillResult {
  const content = response.choices[0]?.message?.content;

  if (!content) {
    throw new Error('Empty response from AI');
  }

  logger.log('AI response:', content);

  // Try multiple patterns to extract JSON
  let jsonStr: string | null = null;

  // Pattern 1: JSON in code block ```json ... ```
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

  // Pattern 2: Raw JSON object { ... }
  if (!jsonStr) {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }
  }

  // Pattern 3: JSON might have trailing text after closing brace
  if (!jsonStr) {
    // Try to find balanced braces
    const start = content.indexOf('{');
    if (start !== -1) {
      let depth = 0;
      let end = start;
      for (let i = start; i < content.length; i++) {
        if (content[i] === '{') depth++;
        if (content[i] === '}') depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
      jsonStr = content.substring(start, end);
    }
  }

  if (!jsonStr) {
    logger.error('No JSON found. Full response:', content);
    throw new Error('No JSON found in AI response. Please try again.');
  }

  try {
    // Clean up common issues
    jsonStr = jsonStr
      .replace(/,\s*}/g, '}') // Remove trailing commas
      .replace(/,\s*]/g, ']') // Remove trailing commas in arrays
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001F\u007F]/g, ''); // Remove control characters

    const result = JSON.parse(jsonStr);

    if (typeof result !== 'object' || result === null || Array.isArray(result)) {
      throw new Error('Response must be a JSON object');
    }

    const cleaned: AIFillResult = {};
    for (const [key, value] of Object.entries(result)) {
      if (value !== null && value !== undefined) {
        cleaned[key] = String(value);
      }
    }

    if (Object.keys(cleaned).length === 0) {
      throw new Error('AI returned empty result');
    }

    return cleaned;
  } catch (parseError) {
    logger.error('Failed to parse AI response:', parseError, 'JSON string:', jsonStr);
    throw new Error('Failed to parse AI response. The AI may have returned malformed JSON.');
  }
}

/**
 * Test OpenRouter API connectivity and key validity
 */
export async function testOpenRouterConnection(apiKey: string, model: string): Promise<{
  success: boolean;
  error?: string;
  model?: string;
}> {
  try {
    if (!apiKey) {
      return { success: false, error: 'No API key configured' };
    }

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 5,
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, error: 'Invalid API key' };
      }
      return { success: false, error: `API error: ${response.status}` };
    }

    return { success: true, model: model };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}
