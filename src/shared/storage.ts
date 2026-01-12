import type { ExtensionSettings, AIProvider, ProviderProfile } from './types';
import { DEFAULT_SETTINGS, AVAILABLE_MODELS, DEFAULT_PROVIDER_PROFILES, DEFAULT_OPENROUTER_MODEL, DEFAULT_GEMINI_MODEL } from './constants';

const STORAGE_KEY = 'daun_autofill_settings';

/**
 * Check if a model ID is valid for a specific provider
 */
function isValidModel(modelId: string, provider: AIProvider, customModels?: { id: string }[]): boolean {
  // Check built-in models for this provider
  if (AVAILABLE_MODELS.some((m) => m.id === modelId && m.provider === provider)) {
    return true;
  }
  // Check custom models
  if (customModels && customModels.some((m) => m.id === modelId)) {
    return true;
  }
  // For OpenRouter, allow any model ID that contains a slash (provider/model format)
  if (provider === 'openrouter' && modelId.includes('/')) {
    return true;
  }
  // For Gemini, allow any model ID that starts with 'gemini'
  if (provider === 'gemini' && modelId.startsWith('gemini')) {
    return true;
  }
  return false;
}

/**
 * Migrate legacy settings to new provider-based format
 */
function migrateToProviderFormat(stored: Partial<ExtensionSettings>): ExtensionSettings {
  // Start with defaults
  const settings: ExtensionSettings = { ...DEFAULT_SETTINGS };

  // Copy over global settings
  if (stored.enabled !== undefined) settings.enabled = stored.enabled;
  if (stored.enabledFieldTypes) settings.enabledFieldTypes = stored.enabledFieldTypes;
  if (stored.enableVisionRecheck !== undefined) settings.enableVisionRecheck = stored.enableVisionRecheck;
  if (stored.targetLanguage) settings.targetLanguage = stored.targetLanguage;
  if (stored.debugMode !== undefined) settings.debugMode = stored.debugMode;
  if (stored.customDomains) settings.customDomains = stored.customDomains;
  if (stored.maxFillRounds !== undefined) settings.maxFillRounds = stored.maxFillRounds;
  if (stored.promptTemplates) settings.promptTemplates = stored.promptTemplates;
  if (stored.activePromptTemplateId !== undefined) settings.activePromptTemplateId = stored.activePromptTemplateId;

  // Check if we already have provider profiles
  if (stored.providers && stored.activeProvider) {
    settings.activeProvider = stored.activeProvider;
    settings.providers = {
      openrouter: stored.providers.openrouter || DEFAULT_PROVIDER_PROFILES.openrouter,
      gemini: stored.providers.gemini || DEFAULT_PROVIDER_PROFILES.gemini,
    };
  } else {
    // Migrate legacy OpenRouter settings to provider profile
    settings.activeProvider = 'openrouter';
    settings.providers = {
      openrouter: {
        apiKey: stored.apiKey || '',
        apiKeys: stored.apiKeys || [],
        primaryApiKeyId: stored.primaryApiKeyId,
        model: stored.model || DEFAULT_OPENROUTER_MODEL,
        customModels: stored.customModels || [],
      },
      gemini: DEFAULT_PROVIDER_PROFILES.gemini,
    };
  }

  // Keep legacy fields in sync with OpenRouter provider (for backward compatibility)
  settings.apiKey = settings.providers.openrouter.apiKey;
  settings.apiKeys = settings.providers.openrouter.apiKeys;
  settings.primaryApiKeyId = settings.providers.openrouter.primaryApiKeyId;
  settings.model = settings.providers.openrouter.model;
  settings.customModels = settings.providers.openrouter.customModels;

  return settings;
}

/**
 * Get settings from Chrome storage (works in popup, background, and content scripts)
 * Validates stored model and resets to default if invalid
 */
export async function getSettings(): Promise<ExtensionSettings> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const stored = result[STORAGE_KEY] as Partial<ExtensionSettings> | undefined;

    // Migrate to new format if needed
    const settings = migrateToProviderFormat(stored || {});

    // Validate models for each provider
    for (const provider of ['openrouter', 'gemini'] as AIProvider[]) {
      const profile = settings.providers[provider];
      if (profile.model && !isValidModel(profile.model, provider, profile.customModels)) {
        console.warn(`[Daun AutoFill] Invalid ${provider} model "${profile.model}", resetting to default`);
        profile.model = provider === 'openrouter' ? DEFAULT_OPENROUTER_MODEL : DEFAULT_GEMINI_MODEL;
      }
    }

    // Keep legacy model in sync
    settings.model = settings.providers.openrouter.model;

    // Save if migration happened
    if (!stored?.providers) {
      await chrome.storage.local.set({ [STORAGE_KEY]: settings });
    }

    return settings;
  } catch (error) {
    console.error('[Daun AutoFill] Failed to get settings:', error);
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Save settings to Chrome storage
 */
export async function saveSettings(updates: Partial<ExtensionSettings>): Promise<void> {
  try {
    const current = await getSettings();
    const newSettings = { ...current, ...updates };

    // If updating a provider profile, merge properly
    if (updates.providers) {
      newSettings.providers = {
        openrouter: { ...current.providers.openrouter, ...updates.providers.openrouter },
        gemini: { ...current.providers.gemini, ...updates.providers.gemini },
      };
    }

    // Keep legacy fields in sync with OpenRouter provider
    if (newSettings.providers?.openrouter) {
      newSettings.apiKey = newSettings.providers.openrouter.apiKey;
      newSettings.apiKeys = newSettings.providers.openrouter.apiKeys;
      newSettings.primaryApiKeyId = newSettings.providers.openrouter.primaryApiKeyId;
      newSettings.model = newSettings.providers.openrouter.model;
      newSettings.customModels = newSettings.providers.openrouter.customModels;
    }

    await chrome.storage.local.set({ [STORAGE_KEY]: newSettings });
  } catch (error) {
    console.error('[Daun AutoFill] Failed to save settings:', error);
    throw error;
  }
}

/**
 * Update a specific provider's profile
 */
export async function updateProviderProfile(
  provider: AIProvider,
  updates: Partial<ProviderProfile>
): Promise<void> {
  const current = await getSettings();
  const currentProfile = current.providers[provider];
  const newProfile = { ...currentProfile, ...updates };

  await saveSettings({
    providers: {
      ...current.providers,
      [provider]: newProfile,
    },
  });
}

/**
 * Switch the active provider
 */
export async function setActiveProvider(provider: AIProvider): Promise<void> {
  await saveSettings({ activeProvider: provider });
}
