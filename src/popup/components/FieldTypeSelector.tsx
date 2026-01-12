import type { FieldType } from '@/shared/types';
import { DEFAULT_ENABLED_FIELD_TYPES } from '@/shared/constants';

interface FieldTypeSelectorProps {
  value: FieldType[];
  onChange: (types: FieldType[]) => void;
}

const FIELD_TYPE_OPTIONS: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Text Input' },
  { value: 'number', label: 'Number Input' },
  { value: 'date', label: 'Date Picker' },
  { value: 'select', label: 'Select/Dropdown' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'radio', label: 'Radio Button' },
  { value: 'switch', label: 'Switch Toggle' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'richtext', label: 'Rich Text Editor' },
  { value: 'dynamic', label: 'Dynamic Fields' },
];

export function FieldTypeSelector({ value, onChange }: FieldTypeSelectorProps) {
  const types = value || DEFAULT_ENABLED_FIELD_TYPES;

  const handleToggle = (type: FieldType) => {
    if (types.includes(type)) {
      onChange(types.filter((t) => t !== type));
    } else {
      onChange([...types, type]);
    }
  };

  const handleSelectAll = () => {
    onChange(FIELD_TYPE_OPTIONS.map((opt) => opt.value));
  };

  const handleDeselectAll = () => {
    onChange([]);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Auto-fill Field Types
        </label>
        <div className="flex gap-2 text-xs">
          <button
            onClick={handleSelectAll}
            className="text-primary hover:underline"
          >
            All
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={handleDeselectAll}
            className="text-primary hover:underline"
          >
            None
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 rounded-lg border">
        {FIELD_TYPE_OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex items-center gap-2 text-sm cursor-pointer"
          >
            <input
              type="checkbox"
              checked={types.includes(option.value)}
              onChange={() => handleToggle(option.value)}
              className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
            />
            <span className="text-gray-700">{option.label}</span>
          </label>
        ))}
      </div>
      <p className="text-xs text-gray-500">
        Only selected field types will be auto-filled
      </p>
    </div>
  );
}
