import { useState } from 'react';
import { FileText, Plus, Trash2, Edit2, Check, Star, Eye, EyeOff } from 'lucide-react';
import type { PromptTemplate } from '@/shared/types';
import { DEFAULT_SYSTEM_PROMPT } from '@/shared/constants';

interface PromptTemplateManagerProps {
  templates: PromptTemplate[];
  activeTemplateId: string | null;
  onTemplatesChange: (templates: PromptTemplate[]) => void;
  onActiveChange: (id: string | null) => void;
}

export function PromptTemplateManager({
  templates,
  activeTemplateId,
  onTemplatesChange,
  onActiveChange,
}: PromptTemplateManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const [showDefaultPrompt, setShowDefaultPrompt] = useState(false);

  const handleStartAdd = () => {
    setIsAdding(true);
    setEditName('');
    setEditPrompt('');
  };

  const handleSaveNew = () => {
    if (!editName.trim() || !editPrompt.trim()) return;

    const newTemplate: PromptTemplate = {
      id: `tpl_${Date.now()}`,
      name: editName.trim(),
      prompt: editPrompt.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    onTemplatesChange([...templates, newTemplate]);
    setIsAdding(false);
    setEditName('');
    setEditPrompt('');
  };

  const handleStartEdit = (template: PromptTemplate) => {
    setEditingId(template.id);
    setEditName(template.name);
    setEditPrompt(template.prompt);
  };

  const handleSaveEdit = () => {
    if (!editName.trim() || !editPrompt.trim() || !editingId) return;

    const updated = templates.map((t) =>
      t.id === editingId
        ? { ...t, name: editName.trim(), prompt: editPrompt.trim(), updatedAt: Date.now() }
        : t
    );

    onTemplatesChange(updated);
    setEditingId(null);
    setEditName('');
    setEditPrompt('');
  };

  const handleDelete = (id: string) => {
    if (!confirm('Delete this prompt template?')) return;

    onTemplatesChange(templates.filter((t) => t.id !== id));
    if (activeTemplateId === id) {
      onActiveChange(null);
    }
  };

  const handleSetActive = (id: string | null) => {
    onActiveChange(id === activeTemplateId ? null : id);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setEditName('');
    setEditPrompt('');
  };

  const isEditing = isAdding || editingId !== null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <FileText className="h-4 w-4" />
          Custom Prompts
        </label>
        {!isEditing && (
          <button
            type="button"
            onClick={handleStartAdd}
            className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
          >
            <Plus className="h-3 w-3" />
            New Template
          </button>
        )}
      </div>

      {/* Default prompt option */}
      <div
        className={`p-2 rounded-lg border text-sm transition-colors ${
          activeTemplateId === null
            ? 'border-primary bg-primary/5'
            : 'border-gray-200 bg-gray-50 hover:border-gray-300'
        }`}
      >
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => handleSetActive(null)}
        >
          <Star
            className={`h-4 w-4 ${activeTemplateId === null ? 'text-yellow-500' : 'text-gray-300'}`}
            fill={activeTemplateId === null ? 'currentColor' : 'none'}
          />
          <span className="font-medium text-gray-700 flex-1">Default Prompt</span>
          {activeTemplateId === null && (
            <span className="text-xs text-primary">Active</span>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowDefaultPrompt(!showDefaultPrompt);
            }}
            className="text-gray-400 hover:text-gray-600"
            title={showDefaultPrompt ? 'Hide prompt' : 'View prompt'}
          >
            {showDefaultPrompt ? (
              <EyeOff className="h-3 w-3" />
            ) : (
              <Eye className="h-3 w-3" />
            )}
          </button>
        </div>
        {showDefaultPrompt ? (
          <pre className="mt-2 p-2 bg-gray-100 rounded text-xs text-gray-600 whitespace-pre-wrap max-h-40 overflow-y-auto">
            {DEFAULT_SYSTEM_PROMPT}
          </pre>
        ) : (
          <p className="text-xs text-gray-500 mt-1 ml-6">
            Built-in prompt optimized for form filling
          </p>
        )}
      </div>

      {/* Template list */}
      {templates.map((template) => {
        const isActive = template.id === activeTemplateId;
        const isEditingThis = editingId === template.id;

        if (isEditingThis) {
          return (
            <div
              key={template.id}
              className="p-3 border border-primary rounded-lg space-y-2"
            >
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Template name"
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary"
                autoFocus
              />
              <textarea
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                placeholder="System prompt... (Use {{URL}} and {{FIELDS}} for placeholders)"
                rows={4}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary resize-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={!editName.trim() || !editPrompt.trim()}
                  className="flex-1 py-1.5 px-3 bg-primary text-white text-sm rounded font-medium disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  <Check className="h-3 w-3" />
                  Save
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
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
            key={template.id}
            className={`p-2 rounded-lg border text-sm transition-colors ${
              isActive
                ? 'border-primary bg-primary/5'
                : 'border-gray-200 bg-gray-50 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSetActive(template.id)}
                className={`${isActive ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'}`}
                title={isActive ? 'Active template' : 'Set as active'}
              >
                <Star className="h-4 w-4" fill={isActive ? 'currentColor' : 'none'} />
              </button>
              <span className="font-medium text-gray-700 flex-1">{template.name}</span>
              {isActive && <span className="text-xs text-primary">Active</span>}
              <button
                type="button"
                onClick={() => handleStartEdit(template)}
                className="text-gray-400 hover:text-gray-600"
                title="Edit"
              >
                <Edit2 className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(template.id)}
                className="text-gray-400 hover:text-red-500"
                title="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1 ml-6 line-clamp-2">{template.prompt}</p>
          </div>
        );
      })}

      {/* Add new template form */}
      {isAdding && (
        <div className="p-3 border border-dashed border-gray-300 rounded-lg space-y-2">
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Template name"
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary"
            autoFocus
          />
          <textarea
            value={editPrompt}
            onChange={(e) => setEditPrompt(e.target.value)}
            placeholder="System prompt... (Use {{URL}} and {{FIELDS}} for placeholders)"
            rows={4}
            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-primary resize-none"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSaveNew}
              disabled={!editName.trim() || !editPrompt.trim()}
              className="flex-1 py-1.5 px-3 bg-primary text-white text-sm rounded font-medium disabled:opacity-50 flex items-center justify-center gap-1"
            >
              <Check className="h-3 w-3" />
              Save Template
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="py-1.5 px-3 border border-gray-300 text-gray-600 text-sm rounded hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500">
        Custom prompts replace the default system prompt. Use <code>{'{{URL}}'}</code> and{' '}
        <code>{'{{FIELDS}}'}</code> as placeholders.
      </p>
    </div>
  );
}
