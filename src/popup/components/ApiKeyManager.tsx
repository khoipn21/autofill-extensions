import { useState } from 'react';
import { Eye, EyeOff, Key, Plus, Trash2, Star, Check, AlertCircle, Edit2 } from 'lucide-react';
import { isValidApiKeyForProvider } from '@/utils/validators';
import type { ApiKeyEntry, AIProvider } from '@/shared/types';
import { PROVIDER_INFO } from '@/shared/constants';

interface ApiKeyManagerProps {
  provider: AIProvider;
  apiKey: string; // Legacy primary key
  apiKeys: ApiKeyEntry[];
  primaryApiKeyId?: string;
  onApiKeyChange: (key: string) => void;
  onApiKeysChange: (keys: ApiKeyEntry[]) => void;
  onPrimaryChange: (id: string | undefined) => void;
  loading?: boolean;
}

export function ApiKeyManager({
  provider,
  apiKey,
  apiKeys,
  primaryApiKeyId,
  onApiKeyChange,
  onApiKeysChange,
  onPrimaryChange,
  loading,
}: ApiKeyManagerProps) {
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [showNewKey, setShowNewKey] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState('');
  const [newKeyName, setNewKeyName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKeyValue, setEditKeyValue] = useState('');
  const [editKeyName, setEditKeyName] = useState('');
  const [showEditKey, setShowEditKey] = useState(false);

  const providerInfo = PROVIDER_INFO[provider];
  const isValidKey = (key: string) => isValidApiKeyForProvider(key, provider);

  const toggleShowKey = (id: string) => {
    setShowKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAddKey = () => {
    if (!isValidKey(newKeyValue)) return;

    const newEntry: ApiKeyEntry = {
      id: `key_${Date.now()}`,
      key: newKeyValue,
      name: newKeyName.trim() || undefined,
      addedAt: Date.now(),
    };

    // If there's a legacy apiKey and no apiKeys yet, migrate it first
    const updatedKeys = [...apiKeys];
    if (apiKey && apiKeys.length === 0) {
      const legacyEntry: ApiKeyEntry = {
        id: `key_legacy_${Date.now() - 1}`,
        key: apiKey,
        name: 'Primary (migrated)',
        addedAt: Date.now() - 1,
      };
      updatedKeys.push(legacyEntry);
      // Set migrated key as primary
      onPrimaryChange(legacyEntry.id);
    }

    updatedKeys.push(newEntry);
    onApiKeysChange(updatedKeys);

    // If this is the first key and no primary, set it as primary
    if (updatedKeys.length === 1 && !primaryApiKeyId && !apiKey) {
      onPrimaryChange(newEntry.id);
      onApiKeyChange(newEntry.key);
    }

    setNewKeyValue('');
    setNewKeyName('');
    setIsAdding(false);
  };

  const handleDeleteKey = (id: string) => {
    const updated = apiKeys.filter((k) => k.id !== id);
    onApiKeysChange(updated);

    // If deleted key was primary, clear primary
    if (primaryApiKeyId === id) {
      onPrimaryChange(undefined);
      // Set first remaining key as primary
      if (updated.length > 0) {
        onPrimaryChange(updated[0].id);
        onApiKeyChange(updated[0].key);
      }
    }
  };

  const handleSetPrimary = (entry: ApiKeyEntry) => {
    onPrimaryChange(entry.id);
    onApiKeyChange(entry.key);
  };

  const handleStartEdit = (entry: ApiKeyEntry) => {
    setEditingId(entry.id);
    setEditKeyValue(entry.key);
    setEditKeyName(entry.name || '');
    setShowEditKey(false);
  };

  const handleSaveEdit = () => {
    if (!editingId || !isValidKey(editKeyValue)) return;

    const updated = apiKeys.map((k) =>
      k.id === editingId
        ? { ...k, key: editKeyValue, name: editKeyName.trim() || undefined }
        : k
    );
    onApiKeysChange(updated);

    // Update primary key if editing the primary
    if (primaryApiKeyId === editingId) {
      onApiKeyChange(editKeyValue);
    }

    setEditingId(null);
    setEditKeyValue('');
    setEditKeyName('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditKeyValue('');
    setEditKeyName('');
  };

  const maskKey = (key: string) => {
    if (key.length <= 12) return '•'.repeat(key.length);
    return key.slice(0, 8) + '•'.repeat(8) + key.slice(-4);
  };

  // Determine effective primary key
  const effectivePrimaryId =
    primaryApiKeyId || (apiKeys.length > 0 ? apiKeys[0].id : undefined);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Key className="h-4 w-4" />
          API Keys
        </label>
        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
          >
            <Plus className="h-3 w-3" />
            Add Key
          </button>
        )}
      </div>

      {/* Legacy primary key display if exists and no apiKeys */}
      {apiKey && apiKeys.length === 0 && (
        <div className="p-2 bg-gray-50 rounded-lg text-sm">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-500" />
            <span className="text-gray-600">Primary:</span>
            <code className="text-xs bg-gray-100 px-1 rounded">
              {showKeys['legacy'] ? apiKey : maskKey(apiKey)}
            </code>
            <button
              type="button"
              onClick={() => toggleShowKey('legacy')}
              className="ml-auto text-gray-400 hover:text-gray-600"
            >
              {showKeys['legacy'] ? (
                <EyeOff className="h-3 w-3" />
              ) : (
                <Eye className="h-3 w-3" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* API Keys list */}
      {apiKeys.length > 0 && (
        <div className="space-y-2">
          {apiKeys.map((entry) => {
            const isPrimary = entry.id === effectivePrimaryId;
            const isEditingThis = editingId === entry.id;

            if (isEditingThis) {
              return (
                <div
                  key={entry.id}
                  className="p-3 border border-primary rounded-lg space-y-2"
                >
                  <input
                    type="text"
                    value={editKeyName}
                    onChange={(e) => setEditKeyName(e.target.value)}
                    placeholder="Label (optional)"
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary"
                    autoFocus
                  />
                  <div className="relative">
                    <input
                      type={showEditKey ? 'text' : 'password'}
                      value={editKeyValue}
                      onChange={(e) => setEditKeyValue(e.target.value)}
                      placeholder={`${providerInfo.keyPrefix}...`}
                      className="w-full px-3 py-1.5 pr-8 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEditKey(!showEditKey)}
                      className="absolute inset-y-0 right-0 pr-2 flex items-center"
                    >
                      {showEditKey ? (
                        <EyeOff className="h-3 w-3 text-gray-400" />
                      ) : (
                        <Eye className="h-3 w-3 text-gray-400" />
                      )}
                    </button>
                  </div>
                  {editKeyValue && !isValidKey(editKeyValue) && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Invalid API key format
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      disabled={!isValidKey(editKeyValue)}
                      className="flex-1 py-1.5 px-3 bg-primary text-white text-sm rounded font-medium disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      <Check className="h-3 w-3" />
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="py-1.5 px-3 border border-gray-300 text-gray-600 text-sm rounded hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={entry.id}
                className={`p-2 rounded-lg border text-sm ${
                  isPrimary ? 'border-primary bg-primary/5' : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSetPrimary(entry)}
                    className={`${isPrimary ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'}`}
                    title={isPrimary ? 'Primary key' : 'Set as primary'}
                  >
                    <Star className="h-4 w-4" fill={isPrimary ? 'currentColor' : 'none'} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {entry.name && (
                        <span className="font-medium text-gray-700">{entry.name}</span>
                      )}
                      <code className="text-xs bg-gray-100 px-1 rounded truncate">
                        {showKeys[entry.id] ? entry.key : maskKey(entry.key)}
                      </code>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleShowKey(entry.id)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {showKeys[entry.id] ? (
                      <EyeOff className="h-3 w-3" />
                    ) : (
                      <Eye className="h-3 w-3" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartEdit(entry)}
                    className="text-gray-400 hover:text-gray-600"
                    title="Edit key"
                  >
                    <Edit2 className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteKey(entry.id)}
                    className="text-gray-400 hover:text-red-500"
                    title="Delete key"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add new key form */}
      {isAdding && (
        <div className="p-3 border border-dashed border-gray-300 rounded-lg space-y-2">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Label (optional, e.g. Personal)"
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary"
          />
          <div className="relative">
            <input
              type={showNewKey ? 'text' : 'password'}
              value={newKeyValue}
              onChange={(e) => setNewKeyValue(e.target.value)}
              placeholder={`${providerInfo.keyPrefix}...`}
              className="w-full px-3 py-1.5 pr-8 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary"
            />
            <button
              type="button"
              onClick={() => setShowNewKey(!showNewKey)}
              className="absolute inset-y-0 right-0 pr-2 flex items-center"
            >
              {showNewKey ? (
                <EyeOff className="h-3 w-3 text-gray-400" />
              ) : (
                <Eye className="h-3 w-3 text-gray-400" />
              )}
            </button>
          </div>
          {newKeyValue && !isValidKey(newKeyValue) && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Invalid API key format (should start with {providerInfo.keyPrefix})
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAddKey}
              disabled={!isValidKey(newKeyValue) || loading}
              className="flex-1 py-1.5 px-3 bg-primary text-white text-sm rounded font-medium disabled:opacity-50 flex items-center justify-center gap-1"
            >
              <Check className="h-3 w-3" />
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setNewKeyValue('');
                setNewKeyName('');
              }}
              className="py-1.5 px-3 border border-gray-300 text-gray-600 text-sm rounded hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500">
        Add multiple API keys for automatic fallback on rate limits (429). Primary key is used
        first.
      </p>
    </div>
  );
}
