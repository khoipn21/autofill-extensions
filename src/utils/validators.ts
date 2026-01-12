import type { AIProvider } from '@/shared/types';

/**
 * Validate OpenRouter API key format
 */
export function isValidOpenRouterApiKey(key: string): boolean {
  // OpenRouter keys start with sk-or-
  return key.startsWith('sk-or-') && key.length > 20;
}

/**
 * Validate Gemini (Google AI Studio) API key format
 */
export function isValidGeminiApiKey(key: string): boolean {
  // Gemini API keys start with AIza and are 39 characters
  return key.startsWith('AIza') && key.length >= 35;
}

/**
 * Validate API key for a specific provider
 */
export function isValidApiKeyForProvider(key: string, provider: AIProvider): boolean {
  switch (provider) {
    case 'gemini':
      return isValidGeminiApiKey(key);
    case 'openrouter':
    default:
      return isValidOpenRouterApiKey(key);
  }
}

/**
 * Legacy validator - validates OpenRouter keys by default
 * @deprecated Use isValidApiKeyForProvider instead
 */
export function isValidApiKey(key: string): boolean {
  return isValidOpenRouterApiKey(key);
}

/**
 * Check if URL is allowed
 * Now allows all domains when extension is enabled
 * @param url The URL to check
 * @param _customDomains Deprecated - kept for API compatibility
 * @param extensionEnabled Whether the extension is globally enabled
 */
export function isAllowedUrl(
  url: string,
  _customDomains?: string[],
  extensionEnabled: boolean = true
): boolean {
  // If extension is disabled globally, return false
  if (!extensionEnabled) {
    return false;
  }

  try {
    // Just validate that it's a proper URL
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if URL is a Daun Admin page (backward compatible)
 * @deprecated Use isAllowedUrl with settings instead
 */
export function isDaunAdminUrl(url: string): boolean {
  return isAllowedUrl(url, [], true);
}
