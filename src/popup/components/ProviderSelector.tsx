import React from 'react';
import { Cpu, Sparkles } from 'lucide-react';
import type { AIProvider } from '@/shared/types';
import { PROVIDER_INFO } from '@/shared/constants';

interface ProviderSelectorProps {
  activeProvider: AIProvider;
  onProviderChange: (provider: AIProvider) => void;
}

const PROVIDERS: AIProvider[] = ['openrouter', 'gemini'];

const PROVIDER_ICONS: Record<AIProvider, React.ReactNode> = {
  openrouter: <Cpu className="w-5 h-5" />,
  gemini: <Sparkles className="w-5 h-5" />,
};

export function ProviderSelector({ activeProvider, onProviderChange }: ProviderSelectorProps) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-300">
        AI Provider
      </label>
      <div className="grid grid-cols-2 gap-3">
        {PROVIDERS.map((provider) => {
          const info = PROVIDER_INFO[provider];
          const isActive = activeProvider === provider;

          return (
            <button
              key={provider}
              type="button"
              onClick={() => onProviderChange(provider)}
              className={`
                relative p-4 rounded-lg border-2 transition-all text-left
                ${isActive
                  ? 'border-purple-500 bg-purple-500/10'
                  : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                }
              `}
            >
              {isActive && (
                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-purple-500" />
              )}
              <div className="flex items-center gap-2 mb-2">
                <span className={isActive ? 'text-purple-400' : 'text-gray-400'}>
                  {PROVIDER_ICONS[provider]}
                </span>
                <span className={`font-medium ${isActive ? 'text-white' : 'text-gray-200'}`}>
                  {info.name}
                </span>
              </div>
              <p className="text-xs text-gray-400 line-clamp-2">
                {info.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
