import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Save, Trash2, Eye, Globe, Bug, Power, RotateCcw } from 'lucide-react';
import { ProviderSelector } from '../components/ProviderSelector';
import { ApiKeyManager } from '../components/ApiKeyManager';
import { DomainManager } from '../components/DomainManager';
import { PromptTemplateManager } from '../components/PromptTemplateManager';
import { ModelSelector } from '../components/ModelSelector';
import { FieldTypeSelector } from '../components/FieldTypeSelector';
import { usePopupStore } from '../store';
import type { FieldType, CustomModel, PromptTemplate, AIProvider, ProviderProfile } from '@/shared/types';
import { DEFAULT_ENABLED_FIELD_TYPES, DEFAULT_PROVIDER_PROFILES } from '@/shared/constants';

export function SettingsPage() {
  const { settings, updateSettings, setPage, loading } = usePopupStore();

  // Provider selection
  const [activeProvider, setActiveProvider] = useState<AIProvider>(settings.activeProvider || 'openrouter');
  const [providers, setProviders] = useState(settings.providers || DEFAULT_PROVIDER_PROFILES);

  // Global settings
  const [enabled, setEnabled] = useState(settings.enabled ?? true);
  const [enabledFieldTypes, setEnabledFieldTypes] = useState<FieldType[]>(
    settings.enabledFieldTypes || DEFAULT_ENABLED_FIELD_TYPES
  );
  const [enableVisionRecheck, setEnableVisionRecheck] = useState(
    settings.enableVisionRecheck ?? false
  );
  const [targetLanguage, setTargetLanguage] = useState<'kr' | 'en'>(
    settings.targetLanguage ?? 'kr'
  );
  const [debugMode, setDebugMode] = useState(settings.debugMode ?? false);
  const [customDomains, setCustomDomains] = useState<string[]>(settings.customDomains ?? []);
  const [maxFillRounds, setMaxFillRounds] = useState(settings.maxFillRounds ?? 3);
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>(
    settings.promptTemplates ?? []
  );
  const [activePromptTemplateId, setActivePromptTemplateId] = useState<string | null>(
    settings.activePromptTemplateId ?? null
  );

  // Current provider profile (derived from providers state)
  const currentProfile = useMemo(() => providers[activeProvider], [providers, activeProvider]);

  // Update local state when settings change
  useEffect(() => {
    setActiveProvider(settings.activeProvider || 'openrouter');
    setProviders(settings.providers || DEFAULT_PROVIDER_PROFILES);
  }, [settings.activeProvider, settings.providers]);

  // Handlers for provider profile updates
  const updateCurrentProviderProfile = (updates: Partial<ProviderProfile>) => {
    setProviders((prev) => ({
      ...prev,
      [activeProvider]: { ...prev[activeProvider], ...updates },
    }));
  };

  const handleProviderChange = (provider: AIProvider) => {
    setActiveProvider(provider);
  };

  const handleSave = async () => {
    await updateSettings({
      activeProvider,
      providers,
      enabled,
      enabledFieldTypes,
      enableVisionRecheck,
      targetLanguage,
      debugMode,
      customDomains,
      maxFillRounds,
      promptTemplates,
      activePromptTemplateId,
    });
    setPage('main');
  };

  const handleSaveCustomModel = (newModel: CustomModel) => {
    const updated = [...(currentProfile.customModels || []), newModel];
    updateCurrentProviderProfile({ customModels: updated });
  };

  const handleDeleteCustomModel = (modelId: string) => {
    const updated = (currentProfile.customModels || []).filter((m) => m.id !== modelId);
    updateCurrentProviderProfile({ customModels: updated });
  };

  const handleClear = async () => {
    if (confirm('Clear all API keys and reset settings?')) {
      await updateSettings({
        activeProvider: 'openrouter',
        providers: DEFAULT_PROVIDER_PROFILES,
        apiKey: '',
        apiKeys: [],
        primaryApiKeyId: undefined,
      });
      setPage('setup');
    }
  };

  // Change site language via injected script
  const handleLanguageChange = async (lang: 'kr' | 'en') => {
    setTargetLanguage(lang);

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'CHANGE_LANGUAGE',
          payload: { language: lang },
        });
      }
    } catch (err) {
      console.warn('Failed to change language:', err);
    }
  };

  return (
    <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setPage('main')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-gray-500" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Settings</h1>
      </div>

      <div className="space-y-4">
        {/* Extension On/Off Toggle */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Power className="h-4 w-4" />
              Extension Enabled
            </label>
            <button
              onClick={() => setEnabled(!enabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                enabled ? 'bg-green-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <p className="text-xs text-gray-500">
            {enabled ? 'Extension is active on allowed domains' : 'Extension is disabled globally'}
          </p>
        </div>

        {/* Provider Selector */}
        <ProviderSelector
          activeProvider={activeProvider}
          onProviderChange={handleProviderChange}
        />

        {/* API Key Manager - Provider Specific */}
        <ApiKeyManager
          provider={activeProvider}
          apiKey={currentProfile.apiKey}
          apiKeys={currentProfile.apiKeys || []}
          primaryApiKeyId={currentProfile.primaryApiKeyId}
          onApiKeyChange={(key) => updateCurrentProviderProfile({ apiKey: key })}
          onApiKeysChange={(keys) => updateCurrentProviderProfile({ apiKeys: keys })}
          onPrimaryChange={(id) => updateCurrentProviderProfile({ primaryApiKeyId: id })}
          loading={loading}
        />

        {/* Model Selector - Provider Specific */}
        <ModelSelector
          value={currentProfile.model}
          onChange={(model) => updateCurrentProviderProfile({ model })}
          provider={activeProvider}
          customModels={currentProfile.customModels || []}
          onSaveCustomModel={handleSaveCustomModel}
          onDeleteCustomModel={handleDeleteCustomModel}
        />

        {/* Domain Manager */}
        <DomainManager customDomains={customDomains} onChange={setCustomDomains} />

        {/* Field Type Selector */}
        <FieldTypeSelector value={enabledFieldTypes} onChange={setEnabledFieldTypes} />

        {/* Max Fill Rounds */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <RotateCcw className="h-4 w-4" />
              Max Fill Rounds
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={10}
                value={maxFillRounds}
                onChange={(e) => setMaxFillRounds(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                className="w-16 px-2 py-1 text-sm text-center border border-gray-300 rounded focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Number of retry rounds for filling unfilled fields (1-10)
          </p>
        </div>

        {/* Vision Recheck Option */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Eye className="h-4 w-4" />
              Vision Recheck
            </label>
            <button
              onClick={() => setEnableVisionRecheck(!enableVisionRecheck)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                enableVisionRecheck ? 'bg-primary' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  enableVisionRecheck ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Use full-page screenshot for second round to visually verify unfilled fields (uses more
            API tokens)
          </p>
        </div>

        {/* Prompt Template Manager */}
        <PromptTemplateManager
          templates={promptTemplates}
          activeTemplateId={activePromptTemplateId}
          onTemplatesChange={setPromptTemplates}
          onActiveChange={setActivePromptTemplateId}
        />

        {/* Site Language Switcher (STG Debugging) */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Globe className="h-4 w-4" />
            Site Language (STG Debug)
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => handleLanguageChange('kr')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                targetLanguage === 'kr'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Korean
            </button>
            <button
              onClick={() => handleLanguageChange('en')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                targetLanguage === 'en'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              English
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Changes site language for testing (requires page reload)
          </p>
        </div>

        {/* Debug Mode - Streaming AI Output */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Bug className="h-4 w-4" />
              Debug Mode
            </label>
            <button
              onClick={() => setDebugMode(!debugMode)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                debugMode ? 'bg-orange-500' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  debugMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Show streaming AI output in real-time debug panel on page
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full py-2 px-4 bg-primary text-white rounded-lg font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
        >
          <Save className="h-4 w-4" />
          Save Settings
        </button>

        <button
          onClick={handleClear}
          className="w-full py-2 px-4 border border-red-300 text-red-600 rounded-lg font-medium hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
        >
          <Trash2 className="h-4 w-4" />
          Clear API Keys
        </button>
      </div>
    </div>
  );
}
