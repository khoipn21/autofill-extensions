// Message types for extension communication
export type MessageType =
  | 'GET_SETTINGS'
  | 'SET_SETTINGS'
  | 'GET_FORM_FIELDS'
  | 'FILL_FORM'
  | 'TAKE_SCREENSHOT'
  | 'ANALYZE_FORM'
  | 'TEST_CONNECTION'
  | 'TRIGGER_AUTOFILL'
  | 'CHANGE_LANGUAGE' // Change site language for STG debugging
  | 'DEBUG_STREAM' // Streaming AI output for debugging
  | 'CANCEL_REQUEST'; // Cancel running AI request

// Extension message structure
export interface ExtensionMessage<T = unknown> {
  type: MessageType;
  payload?: T;
}

// Response structure
export interface ExtensionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Form field types
export type FieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'switch'
  | 'textarea'
  | 'richtext' // Rich text editor (TipTap, Quill, etc.)
  | 'file' // File upload
  | 'dynamic'; // Dynamic repeatable fields

// Label detection source
export type LabelSource =
  | 'aria'
  | 'associated'
  | 'placeholder'
  | 'prop'
  | 'unknown';

// Fill method for special inputs
export type FillMethod =
  | 'direct' // Standard input fill
  | 'popup' // Requires opening a popup/modal to select
  | 'file' // File upload field
  | 'computed' // Auto-computed field (don't fill)
  | 'skip'; // Skip filling (disabled/readonly)

// Detected form field
export interface DetectedField {
  id: string;
  name?: string;
  type: FieldType;
  label: string;
  labelSource: LabelSource;
  selector: string;
  required: boolean;
  currentValue?: string;
  options?: string[];
  // New metadata for smart filling
  isDisabled?: boolean;
  isReadOnly?: boolean;
  fillMethod: FillMethod;
  popupTriggerSelector?: string; // For popup fields, the element to click
}

// Form analysis payload
export interface FormAnalysis {
  url: string;
  fields: DetectedField[];
  screenshot?: string;
  timestamp: number;
}

// AI fill result (field id to value mapping)
export type AIFillResult = Record<string, string>;

// AI provider types
export type AIProvider = 'openrouter' | 'gemini';

// Custom model saved by user
export interface CustomModel {
  id: string;
  name?: string; // Optional friendly name
  addedAt: number; // Timestamp
}

// Provider-specific profile (API keys and settings per provider)
export interface ProviderProfile {
  apiKey: string; // Primary API key
  apiKeys: ApiKeyEntry[]; // Multiple API keys for fallback
  primaryApiKeyId?: string; // ID of primary key
  model: string; // Selected model for this provider
  customModels: CustomModel[]; // User-saved custom models for this provider
}

// API Key entry for multi-key support
export interface ApiKeyEntry {
  id: string; // Unique identifier
  key: string; // The actual API key
  name?: string; // Optional label (e.g., "Personal", "Work")
  addedAt: number; // Timestamp
}

// Custom prompt template
export interface PromptTemplate {
  id: string; // Unique identifier
  name: string; // Template name
  prompt: string; // The system prompt content
  createdAt: number;
  updatedAt: number;
}

// Extension settings
export interface ExtensionSettings {
  // Provider selection
  activeProvider: AIProvider; // Currently active provider
  providers: Record<AIProvider, ProviderProfile>; // Provider-specific profiles

  // Legacy fields (backward compatibility - mapped from providers.openrouter)
  apiKey: string; // Primary API key (backward compatible)
  apiKeys?: ApiKeyEntry[]; // Multiple API keys
  primaryApiKeyId?: string; // ID of primary key
  model: string;
  customModels?: CustomModel[]; // User-saved custom models

  // Global settings (shared across providers)
  enabled: boolean;
  enabledFieldTypes?: FieldType[]; // Field types to auto-fill
  enableVisionRecheck?: boolean; // Use vision (screenshot) for second round verification
  targetLanguage?: 'kr' | 'en'; // Site language for STG debugging
  debugMode?: boolean; // Enable streaming AI output for debugging
  customDomains?: string[]; // Additional domains to enable extension on
  maxFillRounds?: number; // Max rounds for autofill retry (default: 3)
  promptTemplates?: PromptTemplate[]; // Saved prompt templates
  activePromptTemplateId?: string | null; // Currently active template (null = use default)
}

// Available model
export interface AvailableModel {
  id: string;
  name: string;
  cost: string;
  recommended?: boolean;
  supportsVision?: boolean; // Whether model can accept image inputs
  provider: AIProvider; // Which provider this model belongs to
}
