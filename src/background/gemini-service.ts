import { GoogleGenAI } from '@google/genai';
import type { AIFillResult, FormAnalysis, ApiKeyEntry, PromptTemplate } from '@/shared/types';
import { AVAILABLE_MODELS } from '@/shared/constants';
import { logger } from '@/utils/logger';

// Streaming callback type
export type StreamCallback = (chunk: string, fullText: string) => void;

// Track failed API keys in current session
const failedApiKeys = new Set<string>();

// Global abort controller
let currentAbortController: AbortController | null = null;

/**
 * Check if a Gemini model supports vision
 */
function modelSupportsVision(modelId: string): boolean {
  const model = AVAILABLE_MODELS.find((m) => m.id === modelId && m.provider === 'gemini');
  return model?.supportsVision ?? true; // Gemini models generally support vision
}

/**
 * Cancel any running Gemini request
 */
export function cancelGeminiRequest(): boolean {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
    logger.log('Gemini request cancelled');
    return true;
  }
  return false;
}

/**
 * Get next available API key for Gemini
 */
function getNextApiKey(
  apiKey: string,
  apiKeys: ApiKeyEntry[] = [],
  primaryApiKeyId?: string,
  excludeKeys: Set<string> = new Set()
): string | null {
  const orderedKeys: string[] = [];

  if (apiKey && !excludeKeys.has(apiKey)) {
    orderedKeys.push(apiKey);
  }

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
 * Build analysis prompt for Gemini
 */
function buildAnalysisPrompt(formAnalysis: FormAnalysis, activeTemplate?: PromptTemplate, isRetry: boolean = false): string {
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

  // Use custom template if provided
  if (activeTemplate) {
    let prompt = activeTemplate.prompt
      .replace('{{URL}}', formAnalysis.url)
      .replace('{{FIELDS}}', JSON.stringify(fieldsSummary, null, 2));

    if (isRetry) {
      prompt += `\n\n## RETRY: Your previous response failed to parse. Return ONLY valid JSON.`;
    }
    return prompt;
  }

  // Default prompt
  const strictJsonWarning = isRetry
    ? `\n## CRITICAL: JSON ONLY - PREVIOUS ATTEMPT FAILED\nYou MUST return ONLY a valid JSON object. NO explanations, NO markdown.\n`
    : '';

  return `You are a form-filling assistant for testing purposes. Analyze the form screenshot and DOM structure below.

## IMPORTANT: Generate RANDOM and REALISTIC Data
- Generate DIFFERENT random values each time
- Make values look like REAL production data
- For Korean data: use realistic Korean names, addresses, phone numbers
${strictJsonWarning}
## Form URL
${formAnalysis.url}

## Detected Form Fields (from DOM)
${JSON.stringify(fieldsSummary, null, 2)}

## Instructions
1. Look at the screenshot to understand the form context
2. For each field, generate a RANDOM and REALISTIC test value
3. Use Korean values where appropriate (this is a Korean business app)
4. SKIP fields with fillMethod: "skip", "computed", "file" or isDisabled: true
5. Return ONLY a JSON object mapping field id to value

## Example Output
{"field1": "value1", "field2": "value2"}

${isRetry ? 'OUTPUT JSON ONLY. NO OTHER TEXT.' : 'Return ONLY the JSON object, no other text.'}`;
}

/**
 * Parse Gemini response to extract field values
 */
function parseGeminiResponse(content: string): AIFillResult {
  if (!content) {
    throw new Error('Empty response from Gemini');
  }

  logger.log('Gemini response:', content);

  // Try to extract JSON
  let jsonStr: string | null = null;

  // Pattern 1: JSON in code block
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

  // Pattern 2: Raw JSON object
  if (!jsonStr) {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }
  }

  // Pattern 3: Find balanced braces
  if (!jsonStr) {
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
    throw new Error('No JSON found in Gemini response');
  }

  try {
    // Clean up common issues
    jsonStr = jsonStr
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']')
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001F\u007F]/g, '');

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
      throw new Error('Gemini returned empty result');
    }

    return cleaned;
  } catch (parseError) {
    logger.error('Failed to parse Gemini response:', parseError, 'JSON string:', jsonStr);
    throw new Error('Failed to parse Gemini response');
  }
}

/**
 * Analyze form using Gemini API
 */
export async function analyzeFormWithGemini(
  formAnalysis: FormAnalysis,
  apiKey: string,
  apiKeys: ApiKeyEntry[],
  primaryApiKeyId: string | undefined,
  model: string,
  activeTemplate?: PromptTemplate,
  maxRetries: number = 3,
  onStream?: StreamCallback
): Promise<AIFillResult> {
  let currentKey = getNextApiKey(apiKey, apiKeys, primaryApiKeyId, failedApiKeys);

  if (!currentKey) {
    throw new Error('No Gemini API keys available');
  }

  currentAbortController = new AbortController();
  const signal = currentAbortController.signal;
  let lastError: Error | null = null;

  try {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (signal.aborted) {
        throw new Error('Request cancelled');
      }

      try {
        const ai = new GoogleGenAI({ apiKey: currentKey });
        const prompt = buildAnalysisPrompt(formAnalysis, activeTemplate, attempt > 1);
        const supportsVision = modelSupportsVision(model);

        logger.log(`Gemini attempt ${attempt}/${maxRetries}: Using model ${model}`);

        // Build content parts
        const contents: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }> = [];

        // Add image if available and model supports vision
        if (supportsVision && formAnalysis.screenshot) {
          const base64Data = formAnalysis.screenshot.startsWith('data:')
            ? formAnalysis.screenshot.split(',')[1]
            : formAnalysis.screenshot;

          contents.push({
            inlineData: {
              mimeType: 'image/png',
              data: base64Data,
            },
          });
        }

        // Add text prompt
        contents.push({ text: prompt });

        // Make request with streaming for debug mode
        let text = '';

        if (onStream) {
          // Use streaming API
          const response = await ai.models.generateContentStream({
            model: model,
            contents: contents,
            config: {
              temperature: attempt === 1 ? 0.3 : 0.1,
            },
          });

          // Process streaming chunks
          for await (const chunk of response) {
            const chunkText = chunk.text || '';
            text += chunkText;
            onStream(chunkText, text);
          }
        } else {
          // Non-streaming for faster response when debug is off
          const response = await ai.models.generateContent({
            model: model,
            contents: contents,
            config: {
              temperature: attempt === 1 ? 0.3 : 0.1,
            },
          });
          text = response.text || '';
        }

        const result = parseGeminiResponse(text);

        if (Object.keys(result).length === 0) {
          throw new Error('Gemini returned empty result');
        }

        // Success - clear failed keys
        failedApiKeys.clear();
        logger.log(`Successfully parsed ${Object.keys(result).length} fields on attempt ${attempt}`);
        return result;

      } catch (error) {
        if (signal.aborted) {
          throw new Error('Request cancelled');
        }

        const errorMessage = error instanceof Error ? error.message : String(error);

        // Handle rate limit - try next key
        if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('RATE_LIMIT')) {
          logger.warn(`Rate limit hit for Gemini key ending ...${currentKey.slice(-4)}`);
          failedApiKeys.add(currentKey);

          const nextKey = getNextApiKey(apiKey, apiKeys, primaryApiKeyId, failedApiKeys);
          if (nextKey) {
            currentKey = nextKey;
            logger.log(`Switching to fallback key ending ...${currentKey.slice(-4)}`);
            continue;
          }
        }

        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn(`Gemini attempt ${attempt} failed:`, lastError.message);

        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    throw lastError || new Error('Failed to analyze form with Gemini after retries');
  } finally {
    currentAbortController = null;
  }
}

/**
 * Test Gemini API connection
 */
export async function testGeminiConnection(apiKey: string, model: string): Promise<{
  success: boolean;
  error?: string;
  model?: string;
}> {
  try {
    if (!apiKey) {
      return { success: false, error: 'No API key configured' };
    }

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: model,
      contents: 'Hello',
      config: {
        maxOutputTokens: 10,
      },
    });

    if (response.text) {
      return { success: true, model };
    }

    return { success: false, error: 'No response from Gemini' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connection failed';

    if (message.includes('API_KEY_INVALID') || message.includes('401')) {
      return { success: false, error: 'Invalid API key' };
    }
    if (message.includes('PERMISSION_DENIED') || message.includes('403')) {
      return { success: false, error: 'API key does not have permission for this model' };
    }

    return { success: false, error: message };
  }
}
