import { useState } from 'react';
import { Check, Code, Plus, Trash2 } from 'lucide-react';
import { AVAILABLE_MODELS } from '@/shared/constants';
import type { CustomModel, AIProvider } from '@/shared/types';

interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
  provider: AIProvider;
  customModels?: CustomModel[];
  onSaveCustomModel?: (model: CustomModel) => void;
  onDeleteCustomModel?: (modelId: string) => void;
}

export function ModelSelector({
  value,
  onChange,
  provider,
  customModels = [],
  onSaveCustomModel,
  onDeleteCustomModel,
}: ModelSelectorProps) {
  // Filter models by provider
  const providerModels = AVAILABLE_MODELS.filter((m) => m.provider === provider);
  const defaultModel = providerModels[0]?.id || '';

  const isCustomModel = !providerModels.some((m) => m.id === value) && !customModels.some((m) => m.id === value);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customValue, setCustomValue] = useState('');

  const handleCustomSubmit = () => {
    if (customValue.trim()) {
      const modelId = customValue.trim();
      // Save to custom models
      if (onSaveCustomModel && !customModels.some((m) => m.id === modelId)) {
        onSaveCustomModel({
          id: modelId,
          addedAt: Date.now(),
        });
      }
      onChange(modelId);
      setCustomValue('');
      setShowCustomInput(false);
    }
  };

  const handleDeleteCustom = (modelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDeleteCustomModel) {
      onDeleteCustomModel(modelId);
      // If currently selected, switch to default
      if (value === modelId) {
        onChange(defaultModel);
      }
    }
  };

  const getCustomModelHint = () => {
    switch (provider) {
      case 'gemini':
        return 'e.g., gemini-2.5-pro';
      case 'openrouter':
      default:
        return 'e.g., openai/gpt-4o';
    }
  };

  const getModelDocsUrl = () => {
    switch (provider) {
      case 'gemini':
        return 'https://ai.google.dev/gemini-api/docs/models/gemini';
      case 'openrouter':
      default:
        return 'https://openrouter.ai/models';
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">AI Model</label>
      <div className="space-y-2">
        {/* Built-in models for this provider */}
        {providerModels.map((model) => (
          <button
            key={model.id}
            onClick={() => {
              onChange(model.id);
              setShowCustomInput(false);
            }}
            className={`w-full p-3 rounded-lg border text-left transition-colors ${
              value === model.id
                ? 'border-primary bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm flex items-center gap-2">
                  {model.name}
                  {model.recommended && (
                    <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                      Recommended
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500">Cost: {model.cost}</div>
              </div>
              {value === model.id && <Check className="h-4 w-4 text-primary" />}
            </div>
          </button>
        ))}

        {/* Saved custom models */}
        {customModels.length > 0 && (
          <>
            <div className="text-xs text-gray-500 font-medium pt-2">Saved Custom Models</div>
            {customModels.map((model) => (
              <button
                key={model.id}
                onClick={() => {
                  onChange(model.id);
                  setShowCustomInput(false);
                }}
                className={`w-full p-3 rounded-lg border text-left transition-colors ${
                  value === model.id
                    ? 'border-primary bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{model.name || model.id}</div>
                    <div className="text-xs text-gray-500 truncate">
                      <code>{model.id}</code>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {value === model.id && <Check className="h-4 w-4 text-primary" />}
                    <button
                      onClick={(e) => handleDeleteCustom(model.id, e)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      title="Delete custom model"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </button>
            ))}
          </>
        )}

        {/* Add Custom Model Button */}
        <button
          onClick={() => setShowCustomInput(true)}
          className={`w-full p-3 rounded-lg border text-left transition-colors ${
            isCustomModel
              ? 'border-primary bg-blue-50'
              : 'border-dashed border-gray-300 hover:border-gray-400'
          }`}
        >
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-gray-500" />
            <div>
              <div className="font-medium text-sm">Add Custom Model</div>
              <div className="text-xs text-gray-500">Enter any model ID</div>
            </div>
          </div>
        </button>

        {/* Custom Model Input */}
        {showCustomInput && (
          <div className="space-y-2 p-3 bg-gray-50 rounded-lg">
            <div className="flex gap-2">
              <input
                type="text"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
                placeholder={getCustomModelHint()}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                autoFocus
              />
              <button
                onClick={handleCustomSubmit}
                disabled={!customValue.trim()}
                className="px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-primary/90"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setShowCustomInput(false);
                  setCustomValue('');
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Find models at{' '}
              <a
                href={getModelDocsUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {provider === 'gemini' ? 'Google AI Studio' : 'openrouter.ai/models'}
              </a>
            </p>
          </div>
        )}

        {/* Show current custom model if not in saved list */}
        {isCustomModel && value && (
          <div className="text-xs text-gray-500 px-1 flex items-center gap-2">
            <Code className="h-3 w-3" />
            Using: <code className="bg-gray-100 px-1 rounded">{value}</code>
            <button
              onClick={() => {
                if (onSaveCustomModel) {
                  onSaveCustomModel({ id: value, addedAt: Date.now() });
                }
              }}
              className="text-primary hover:underline"
            >
              Save
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
