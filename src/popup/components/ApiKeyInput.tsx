import { useState } from 'react';
import { Eye, EyeOff, Key, Check, AlertCircle } from 'lucide-react';
import { isValidApiKey } from '@/utils/validators';

interface ApiKeyInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading?: boolean;
}

export function ApiKeyInput({ value, onChange, onSubmit, loading }: ApiKeyInputProps) {
  const [showKey, setShowKey] = useState(false);
  const isValid = isValidApiKey(value);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid) onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          OpenRouter API Key
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Key className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type={showKey ? 'text' : 'password'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="sk-or-..."
            className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            disabled={loading}
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
          >
            {showKey ? (
              <EyeOff className="h-4 w-4 text-gray-400" />
            ) : (
              <Eye className="h-4 w-4 text-gray-400" />
            )}
          </button>
        </div>
        {value && !isValid && (
          <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Invalid API key format
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={!isValid || loading}
        className="w-full py-2 px-4 bg-primary text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            Saving...
          </>
        ) : (
          <>
            <Check className="h-4 w-4" />
            Save API Key
          </>
        )}
      </button>
    </form>
  );
}
