import type { AvailableModel, FieldType } from './types';

// OpenRouter API
export const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Default model - using free vision model
export const DEFAULT_MODEL = 'google/gemini-2.0-flash-exp:free';

// Available models (vision-capable models listed first)
export const AVAILABLE_MODELS: AvailableModel[] = [
  {
    id: 'google/gemini-2.0-flash-exp:free',
    name: 'Gemini 2.0 Flash Exp (Free, Vision)',
    cost: 'Free',
    recommended: true,
    supportsVision: true,
  },
  {
    id: 'allenai/molmo-2-8b:free',
    name: 'Molmo 2 8B (Free, Vision)',
    cost: 'Free',
    supportsVision: true,
  },
  {
    id: 'nvidia/nemotron-nano-12b-v2-vl:free',
    name: 'Nemotron VL (Free, Vision)',
    cost: 'Free',
    supportsVision: true,
  },
  {
    id: 'mistralai/devstral-2512:free',
    name: 'Devstral (Free, Text-only)',
    cost: 'Free',
    supportsVision: false,
  },
  {
    id: 'google/gemini-2.0-flash-001',
    name: 'Gemini 2.0 Flash (Vision)',
    cost: '$0.10/1M tokens',
    supportsVision: true,
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini (Vision)',
    cost: '$0.15/1M tokens',
    supportsVision: true,
  },
];

// Default enabled field types
export const DEFAULT_ENABLED_FIELD_TYPES: FieldType[] = [
  'text',
  'number',
  'date',
  'select',
  'checkbox',
  'radio',
  'switch',
  'textarea',
  'richtext',
  'dynamic',
];

// Default settings
export const DEFAULT_SETTINGS = {
  apiKey: '',
  apiKeys: [] as { id: string; key: string; name?: string; addedAt: number }[],
  primaryApiKeyId: undefined as string | undefined,
  model: DEFAULT_MODEL,
  enabled: true,
  enabledFieldTypes: DEFAULT_ENABLED_FIELD_TYPES,
  enableVisionRecheck: false, // Disabled by default to save API tokens
  targetLanguage: 'kr' as const, // Korean by default
  debugMode: false, // Streaming debug mode disabled by default
  customModels: [] as { id: string; name?: string; addedAt: number }[], // User-saved custom models
  customDomains: [] as string[], // Additional whitelisted domains
  maxFillRounds: 3, // Default max fill rounds
  promptTemplates: [] as { id: string; name: string; prompt: string; createdAt: number; updatedAt: number }[],
  activePromptTemplateId: null as string | null,
};

// Default domains where extension is active
export const DEFAULT_ALLOWED_DOMAINS = [
  'localhost',
  '127.0.0.1',
  'daun.kr',
  'daun-dev.kr',
  'daun-stg.kr',
  'admin.daun.kr',
  'stg.daun.kr',
  'dev.daun.kr',
  'daun-cms.axndx.org',
  'daun.axndx.org',
];

// Default system prompt (displayed in settings, actual prompt is in ai-service.ts)
export const DEFAULT_SYSTEM_PROMPT = `You are a form-filling assistant for testing purposes. Analyze the form screenshot and DOM structure below.

## IMPORTANT: Generate RANDOM and REALISTIC Data
- Generate DIFFERENT random values each time - never repeat the same data
- Make values look like REAL production data, not obvious test data
- Randomize names, numbers, dates, and all values naturally
- For Korean data: use realistic Korean names, addresses, phone numbers, business names

## Form URL
{{URL}}

## Detected Form Fields (from DOM)
{{FIELDS}}

## Instructions
1. Look at the screenshot to understand the form context
2. For each field, generate a RANDOM and REALISTIC test value
3. Use Korean values where appropriate (this is a Korean business app)
4. For required fields, always provide a value
5. For select fields, choose from the available options if provided
6. SKIP these fields (do not include in response):
   - Fields with fillMethod: "skip" (disabled)
   - Fields with fillMethod: "computed" (auto-generated)
   - Fields with fillMethod: "file" (file uploads)
   - Fields with isDisabled: true
7. For popup fields (fillMethod: "popup"), provide a category path or selection value
8. For richtext fields, provide HTML content or plain text

## Guidelines for RANDOM Realistic Values
- Business name: Random Korean company names
- Person name: Random Korean names - generate different each time
- Phone: Korean format with random numbers (e.g., "010-XXXX-XXXX")
- Email: Random realistic emails
- Address: Random Korean addresses
- Dates: Random dates within reasonable ranges (YYYY-MM-DD format)
- Numbers: Random values within appropriate ranges
- Prices: Random amounts that look realistic

Return ONLY the JSON object, no other text.`;

// Mantine component selectors
export const MANTINE_SELECTORS = {
  // Text inputs
  textInput: '.mantine-TextInput-input, input.mantine-Input-input',
  textarea: '.mantine-Textarea-input, textarea.mantine-Input-input',
  // Select & Autocomplete
  select: '.mantine-Select-input',
  autocomplete: '.mantine-Autocomplete-input',
  multiSelect: '.mantine-MultiSelect-input',
  tagsInput: '.mantine-TagsInput-input',
  // Checkbox & Radio
  checkbox: '.mantine-Checkbox-input',
  radio: '.mantine-Radio-input',
  switch: '.mantine-Switch-input',
  // Date & Time
  dateInput: '.mantine-DateInput-input, .mantine-DatePickerInput-input, .mantine-DateTimePicker-input',
  timeInput: '.mantine-TimeInput-input',
  // Number
  numberInput: '.mantine-NumberInput-input',
  // Rich text editors (react-quill, TipTap, ProseMirror)
  richText: '.ql-editor, .mantine-RichTextEditor-content, .tiptap, .ProseMirror, [contenteditable="true"]:not(.mantine-Input-input)',
  // File upload
  fileInput: 'input[type="file"], .mantine-FileInput-input, .mantine-Dropzone-root',
  // Dynamic form inputs (marketplace attributes pattern)
  dynamicInput: '[name^="dynamic-"]',
  // Color input
  colorInput: '.mantine-ColorInput-input',
};
