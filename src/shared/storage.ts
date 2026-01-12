import type { ExtensionSettings } from './types';
import { DEFAULT_SETTINGS, AVAILABLE_MODELS, DEFAULT_MODEL } from './constants';

const STORAGE_KEY = 'daun_autofill_settings';

/**
 * Check if a model ID is valid (exists in available models or custom models)
 */
function isValidModel(modelId: string, customModels?: { id: string }[]): boolean {
  // Check built-in models
  if (AVAILABLE_MODELS.some((m) => m.id === modelId)) {
    return true;
  }
  // Check custom models
  if (customModels && customModels.some((m) => m.id === modelId)) {
    return true;
  }
  // Allow any model ID that looks valid (contains a slash like "provider/model")
  // This allows custom models that haven't been saved yet
  if (modelId.includes('/')) {
    return true;
  }
  return false;
}

/**
 * Get settings from Chrome storage (works in popup, background, and content scripts)
 * Validates stored model and resets to default if invalid
 */
export async function getSettings(): Promise<ExtensionSettings> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const stored = result[STORAGE_KEY] as Partial<ExtensionSettings> | undefined;
    const settings = { ...DEFAULT_SETTINGS, ...(stored || {}) };

    // Validate model - reset to default if stored model is invalid/deprecated
    if (settings.model && !isValidModel(settings.model, settings.customModels)) {
      console.warn(`[Daun AutoFill] Invalid model "${settings.model}", resetting to default`);
      settings.model = DEFAULT_MODEL;
      // Save the corrected settings
      await chrome.storage.local.set({ [STORAGE_KEY]: settings });
    }

    return settings;
  } catch (error) {
    console.error('[Daun AutoFill] Failed to get settings:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save settings to Chrome storage
 */
export async function saveSettings(updates: Partial<ExtensionSettings>): Promise<void> {
  try {
    const current = await getSettings();
    const newSettings = { ...current, ...updates };
    await chrome.storage.local.set({ [STORAGE_KEY]: newSettings });
  } catch (error) {
    console.error('[Daun AutoFill] Failed to save settings:', error);
    throw error;
  }
}
