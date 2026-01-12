import { DEFAULT_ALLOWED_DOMAINS } from '@/shared/constants';

/**
 * Validate OpenRouter API key format
 */
export function isValidApiKey(key: string): boolean {
  // OpenRouter keys start with sk-or-
  return key.startsWith('sk-or-') && key.length > 20;
}

/**
 * Check if URL is allowed based on default domains and custom domains
 * @param url The URL to check
 * @param customDomains Additional user-configured domains
 * @param extensionEnabled Whether the extension is globally enabled
 */
export function isAllowedUrl(
  url: string,
  customDomains: string[] = [],
  extensionEnabled: boolean = true
): boolean {
  // If extension is disabled globally, return false
  if (!extensionEnabled) {
    return false;
  }

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // Check default domains
    for (const domain of DEFAULT_ALLOWED_DOMAINS) {
      if (hostname === domain || hostname.endsWith(`.${domain}`)) {
        return true;
      }
    }

    // Check custom domains
    for (const domain of customDomains) {
      const normalizedDomain = domain.toLowerCase().trim();
      if (normalizedDomain && (hostname === normalizedDomain || hostname.endsWith(`.${normalizedDomain}`))) {
        return true;
      }
    }

    return false;
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
