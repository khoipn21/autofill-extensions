import type { AvailableModel, FieldType, AIProvider, ProviderProfile } from './types';

// API URLs
export const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta';

// Default models per provider
export const DEFAULT_OPENROUTER_MODEL = 'google/gemini-2.0-flash-exp:free';
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
export const DEFAULT_MODEL = DEFAULT_OPENROUTER_MODEL; // Legacy

// Provider display info
export const PROVIDER_INFO: Record<AIProvider, { name: string; description: string; keyPrefix: string }> = {
  openrouter: {
    name: 'OpenRouter',
    description: 'Multi-model gateway (access Gemini, GPT-4o, Claude via one API)',
    keyPrefix: 'sk-or-',
  },
  gemini: {
    name: 'Gemini (Google AI Studio)',
    description: 'Direct access to Google Gemini models',
    keyPrefix: 'AIza',
  },
};

// Available models (vision-capable models listed first)
export const AVAILABLE_MODELS: AvailableModel[] = [
  // OpenRouter models
  {
    id: 'google/gemini-2.0-flash-exp:free',
    name: 'Gemini 2.0 Flash Exp (Free, Vision)',
    cost: 'Free',
    recommended: true,
    supportsVision: true,
    provider: 'openrouter',
  },
  {
    id: 'allenai/molmo-2-8b:free',
    name: 'Molmo 2 8B (Free, Vision)',
    cost: 'Free',
    supportsVision: true,
    provider: 'openrouter',
  },
  {
    id: 'nvidia/nemotron-nano-12b-v2-vl:free',
    name: 'Nemotron VL (Free, Vision)',
    cost: 'Free',
    supportsVision: true,
    provider: 'openrouter',
  },
  {
    id: 'mistralai/devstral-2512:free',
    name: 'Devstral (Free, Text-only)',
    cost: 'Free',
    supportsVision: false,
    provider: 'openrouter',
  },
  {
    id: 'google/gemini-2.0-flash-001',
    name: 'Gemini 2.0 Flash (Vision)',
    cost: '$0.10/1M tokens',
    supportsVision: true,
    provider: 'openrouter',
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini (Vision)',
    cost: '$0.15/1M tokens',
    supportsVision: true,
    provider: 'openrouter',
  },
  // Gemini (Google AI Studio) models
  // Gemini 3 models
  {
    id: 'gemini-3-pro-preview',
    name: 'Gemini 3 Pro (Preview)',
    cost: 'Free tier available',
    supportsVision: true,
    provider: 'gemini',
  },
  {
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3 Flash (Preview)',
    cost: 'Free tier available',
    recommended: true,
    supportsVision: true,
    provider: 'gemini',
  },
  // Gemini 2.5 models
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    cost: 'Free tier available',
    supportsVision: true,
    provider: 'gemini',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    cost: 'Free tier available',
    supportsVision: true,
    provider: 'gemini',
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    cost: 'Free tier available',
    supportsVision: true,
    provider: 'gemini',
  },
  // Gemini 2.0 models
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    cost: 'Free tier available',
    supportsVision: true,
    provider: 'gemini',
  },
  {
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash Lite',
    cost: 'Free tier available',
    supportsVision: true,
    provider: 'gemini',
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

// Default provider profiles
export const DEFAULT_PROVIDER_PROFILES: Record<AIProvider, ProviderProfile> = {
  openrouter: {
    apiKey: '',
    apiKeys: [],
    primaryApiKeyId: undefined,
    model: DEFAULT_OPENROUTER_MODEL,
    customModels: [],
  },
  gemini: {
    apiKey: '',
    apiKeys: [],
    primaryApiKeyId: undefined,
    model: DEFAULT_GEMINI_MODEL,
    customModels: [],
  },
};

// Default settings
export const DEFAULT_SETTINGS = {
  // Provider settings
  activeProvider: 'openrouter' as AIProvider,
  providers: DEFAULT_PROVIDER_PROFILES,

  // Legacy fields (backward compatible - will be synced with providers.openrouter)
  apiKey: '',
  apiKeys: [] as { id: string; key: string; name?: string; addedAt: number }[],
  primaryApiKeyId: undefined as string | undefined,
  model: DEFAULT_MODEL,
  customModels: [] as { id: string; name?: string; addedAt: number }[],

  // Global settings
  enabled: true,
  enabledFieldTypes: DEFAULT_ENABLED_FIELD_TYPES,
  enableVisionRecheck: false, // Disabled by default to save API tokens
  targetLanguage: 'kr' as const, // Korean by default
  debugMode: false, // Streaming debug mode disabled by default
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
