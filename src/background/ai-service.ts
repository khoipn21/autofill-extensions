/**
 * AI Service Router - Routes requests to the appropriate provider
 */
import type { AIFillResult, FormAnalysis, AIProvider } from '@/shared/types';
import { getSettings } from './storage';
import { analyzeFormWithOpenRouter, testOpenRouterConnection, cancelAIRequest as cancelOpenRouterRequest } from './openrouter-service';
import { analyzeFormWithGemini, testGeminiConnection, cancelGeminiRequest } from './gemini-service';
import { logger } from '@/utils/logger';

// Re-export types
export type { StreamCallback } from './openrouter-service';

/**
 * Cancel any running AI request (delegates to active provider)
 */
export function cancelAIRequest(): boolean {
  // Try to cancel both providers
  const openRouterCancelled = cancelOpenRouterRequest();
  const geminiCancelled = cancelGeminiRequest();
  return openRouterCancelled || geminiCancelled;
}

/**
 * Get the active provider profile from settings
 */
function getActiveProviderProfile(settings: Awaited<ReturnType<typeof getSettings>>) {
  const provider = settings.activeProvider || 'openrouter';
  const profile = settings.providers?.[provider];

  // Fallback to legacy settings if no provider profile exists
  if (!profile || !profile.apiKey) {
    if (provider === 'openrouter') {
      return {
        provider: 'openrouter' as AIProvider,
        apiKey: settings.apiKey,
        apiKeys: settings.apiKeys || [],
        primaryApiKeyId: settings.primaryApiKeyId,
        model: settings.model,
        customModels: settings.customModels || [],
      };
    }
    // Return empty profile for non-OpenRouter providers
    return {
      provider,
      apiKey: profile?.apiKey || '',
      apiKeys: profile?.apiKeys || [],
      primaryApiKeyId: profile?.primaryApiKeyId,
      model: profile?.model || '',
      customModels: profile?.customModels || [],
    };
  }

  return {
    provider,
    ...profile,
  };
}

/**
 * Analyze form using the active AI provider
 * Includes retry logic for failed JSON parsing and 429 fallback
 */
export async function analyzeFormWithAI(
  formAnalysis: FormAnalysis,
  maxRetries: number = 3,
  onStream?: (chunk: string, fullText: string) => void
): Promise<AIFillResult> {
  const settings = await getSettings();
  const profile = getActiveProviderProfile(settings);

  // Get active prompt template
  const activeTemplate = settings.activePromptTemplateId
    ? settings.promptTemplates?.find(t => t.id === settings.activePromptTemplateId)
    : undefined;

  logger.log(`Using provider: ${profile.provider}, model: ${profile.model}`);

  switch (profile.provider) {
    case 'gemini':
      return analyzeFormWithGemini(
        formAnalysis,
        profile.apiKey,
        profile.apiKeys,
        profile.primaryApiKeyId,
        profile.model,
        activeTemplate,
        maxRetries,
        onStream
      );

    case 'openrouter':
    default:
      return analyzeFormWithOpenRouter(
        formAnalysis,
        profile.apiKey,
        profile.apiKeys,
        profile.primaryApiKeyId,
        profile.model,
        activeTemplate,
        settings.debugMode || false,
        maxRetries,
        onStream
      );
  }
}

/**
 * Test API connectivity for the active provider
 */
export async function testApiConnection(): Promise<{
  success: boolean;
  error?: string;
  model?: string;
}> {
  const settings = await getSettings();
  const profile = getActiveProviderProfile(settings);

  logger.log(`Testing connection for provider: ${profile.provider}`);

  switch (profile.provider) {
    case 'gemini':
      return testGeminiConnection(profile.apiKey, profile.model);

    case 'openrouter':
    default:
      return testOpenRouterConnection(profile.apiKey, profile.model);
  }
}

/**
 * Test API connectivity for a specific provider
 */
export async function testProviderConnection(
  provider: AIProvider,
  apiKey: string,
  model: string
): Promise<{
  success: boolean;
  error?: string;
  model?: string;
}> {
  logger.log(`Testing connection for provider: ${provider}`);

  switch (provider) {
    case 'gemini':
      return testGeminiConnection(apiKey, model);

    case 'openrouter':
    default:
      return testOpenRouterConnection(apiKey, model);
  }
}
