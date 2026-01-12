import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { ApiKeyInput } from '../components/ApiKeyInput';
import { ModelSelector } from '../components/ModelSelector';
import { ProviderSelector } from '../components/ProviderSelector';
import { usePopupStore } from '../store';
import { DEFAULT_OPENROUTER_MODEL, DEFAULT_GEMINI_MODEL, PROVIDER_INFO } from '@/shared/constants';
import type { AIProvider } from '@/shared/types';

export function SetupPage() {
  const { updateSettings, setPage, loading } = usePopupStore();
  const [provider, setProvider] = useState<AIProvider>('openrouter');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(DEFAULT_OPENROUTER_MODEL);

  const handleProviderChange = (newProvider: AIProvider) => {
    setProvider(newProvider);
    // Reset model to default for new provider
    setModel(newProvider === 'openrouter' ? DEFAULT_OPENROUTER_MODEL : DEFAULT_GEMINI_MODEL);
  };

  const handleSubmit = async () => {
    // Save settings with provider-specific API key and model
    await updateSettings({
      activeProvider: provider,
      providers: {
        openrouter: provider === 'openrouter'
          ? { apiKey, apiKeys: [], model, customModels: [] }
          : { apiKey: '', apiKeys: [], model: DEFAULT_OPENROUTER_MODEL, customModels: [] },
        gemini: provider === 'gemini'
          ? { apiKey, apiKeys: [], model, customModels: [] }
          : { apiKey: '', apiKeys: [], model: DEFAULT_GEMINI_MODEL, customModels: [] },
      },
      // Keep legacy fields in sync for backward compatibility
      apiKey: provider === 'openrouter' ? apiKey : '',
      model: provider === 'openrouter' ? model : DEFAULT_OPENROUTER_MODEL,
    });
    setPage('main');
  };

  const providerInfo = PROVIDER_INFO[provider];

  return (
    <div className="p-4 space-y-5">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mb-3">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">AI Auto-Fill</h1>
        <p className="text-sm text-gray-500 mt-1">
          AI-powered form auto-fill extension
        </p>
      </div>

      <div className="border-t pt-4">
        <ProviderSelector
          activeProvider={provider}
          onProviderChange={handleProviderChange}
        />
      </div>

      <div className="border-t pt-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          {providerInfo.name} API Key
        </h2>
        <ApiKeyInput
          value={apiKey}
          onChange={setApiKey}
          onSubmit={handleSubmit}
          loading={loading}
          provider={provider}
        />
      </div>

      <div className="border-t pt-4">
        <ModelSelector value={model} onChange={setModel} provider={provider} />
      </div>

      <p className="text-xs text-gray-400 text-center">
        Get your API key from{' '}
        <a
          href={provider === 'openrouter' ? 'https://openrouter.ai/keys' : 'https://aistudio.google.com/apikey'}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          {provider === 'openrouter' ? 'openrouter.ai/keys' : 'aistudio.google.com/apikey'}
        </a>
      </p>
    </div>
  );
}
