import { useState } from 'react';
import { Globe, Plus, X, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { DEFAULT_ALLOWED_DOMAINS } from '@/shared/constants';

interface DomainManagerProps {
  customDomains: string[];
  onChange: (domains: string[]) => void;
}

export function DomainManager({ customDomains, onChange }: DomainManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [showAllDefaults, setShowAllDefaults] = useState(false);

  const handleAdd = () => {
    const domain = newDomain.trim().toLowerCase();
    if (!domain) return;

    // Basic domain validation
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/.test(domain)) {
      return;
    }

    // Don't add duplicates
    if (customDomains.includes(domain) || DEFAULT_ALLOWED_DOMAINS.includes(domain)) {
      return;
    }

    onChange([...customDomains, domain]);
    setNewDomain('');
    setIsAdding(false);
  };

  const handleRemove = (domain: string) => {
    onChange(customDomains.filter((d) => d !== domain));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    } else if (e.key === 'Escape') {
      setIsAdding(false);
      setNewDomain('');
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Globe className="h-4 w-4" />
          Allowed Domains
        </label>
        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
          >
            <Plus className="h-3 w-3" />
            Add Domain
          </button>
        )}
      </div>

      {/* Default domains */}
      <div className="space-y-1">
        <div className="flex flex-wrap gap-1">
          {(showAllDefaults ? DEFAULT_ALLOWED_DOMAINS : DEFAULT_ALLOWED_DOMAINS.slice(0, 4)).map(
            (domain) => (
              <span
                key={domain}
                className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full"
                title="Default domain"
              >
                {domain}
              </span>
            )
          )}
        </div>
        {DEFAULT_ALLOWED_DOMAINS.length > 4 && (
          <button
            type="button"
            onClick={() => setShowAllDefaults(!showAllDefaults)}
            className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
          >
            {showAllDefaults ? (
              <>
                <ChevronUp className="h-3 w-3" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" />
                Show all {DEFAULT_ALLOWED_DOMAINS.length} defaults
              </>
            )}
          </button>
        )}
      </div>

      {/* Custom domains */}
      {customDomains.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {customDomains.map((domain) => (
            <span
              key={domain}
              className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full flex items-center gap-1"
            >
              {domain}
              <button
                type="button"
                onClick={() => handleRemove(domain)}
                className="hover:text-red-500"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Add new domain form */}
      {isAdding && (
        <div className="flex gap-2">
          <input
            type="text"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="example.com"
            className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary"
            autoFocus
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!newDomain.trim()}
            className="py-1.5 px-3 bg-primary text-white text-sm rounded font-medium disabled:opacity-50 flex items-center gap-1"
          >
            <Check className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => {
              setIsAdding(false);
              setNewDomain('');
            }}
            className="py-1.5 px-3 border border-gray-300 text-gray-600 text-sm rounded hover:bg-gray-50"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <p className="text-xs text-gray-500">
        Extension activates on default domains plus your custom domains.
      </p>
    </div>
  );
}
