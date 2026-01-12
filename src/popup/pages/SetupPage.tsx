import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { ApiKeyInput } from '../components/ApiKeyInput';
import { ModelSelector } from '../components/ModelSelector';
import { usePopupStore } from '../store';
import { DEFAULT_MODEL } from '@/shared/constants';

export function SetupPage() {
  const { updateSettings, setPage, loading } = usePopupStore();
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(DEFAULT_MODEL);

  const handleSubmit = async () => {
    await updateSettings({ apiKey, model });
    setPage('main');
  };

  return (
    <div className="p-4 space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mb-3">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">Daun Auto-Fill</h1>
        <p className="text-sm text-gray-500 mt-1">
          AI-powered form auto-fill for Daun Admin
        </p>
      </div>

      <div className="border-t pt-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Get Started</h2>
        <ApiKeyInput
          value={apiKey}
          onChange={setApiKey}
          onSubmit={handleSubmit}
          loading={loading}
        />
      </div>

      <div className="border-t pt-4">
        <ModelSelector value={model} onChange={setModel} />
      </div>

      <p className="text-xs text-gray-400 text-center">
        Get your API key from{' '}
        <a
          href="https://openrouter.ai/keys"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          openrouter.ai/keys
        </a>
      </p>
    </div>
  );
}
