/**
 * Validate OpenRouter API key format
 */
export function isValidApiKey(key: string): boolean {
  // OpenRouter keys start with sk-or-
  return key.startsWith('sk-or-') && key.length > 20;
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
