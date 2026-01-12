import type { DetectedField, FieldType, LabelSource, FillMethod } from '@/shared/types';
import { MANTINE_SELECTORS } from '@/shared/constants';
import { logger } from '@/utils/logger';

/**
 * Main entry point for form analysis
 */
export function analyzeFormFields(): DetectedField[] {
  logger.log('Starting DOM analysis...');
  const fields: DetectedField[] = [];

  // Collect all input types
  const textInputs = document.querySelectorAll(MANTINE_SELECTORS.textInput);
  const selects = document.querySelectorAll(MANTINE_SELECTORS.select);
  const autocompletes = document.querySelectorAll(MANTINE_SELECTORS.autocomplete);
  const multiSelects = document.querySelectorAll(MANTINE_SELECTORS.multiSelect);
  const tagsInputs = document.querySelectorAll(MANTINE_SELECTORS.tagsInput);
  const textareas = document.querySelectorAll(MANTINE_SELECTORS.textarea);
  const checkboxes = document.querySelectorAll(MANTINE_SELECTORS.checkbox);
  const radios = document.querySelectorAll(MANTINE_SELECTORS.radio);
  const switches = document.querySelectorAll(MANTINE_SELECTORS.switch);
  const dateInputs = document.querySelectorAll(MANTINE_SELECTORS.dateInput);
  const timeInputs = document.querySelectorAll(MANTINE_SELECTORS.timeInput);
  const numberInputs = document.querySelectorAll(MANTINE_SELECTORS.numberInput);
  const richTextEditors = document.querySelectorAll(MANTINE_SELECTORS.richText);
  const fileInputs = document.querySelectorAll(MANTINE_SELECTORS.fileInput);
  const colorInputs = document.querySelectorAll(MANTINE_SELECTORS.colorInput);

  // Process each type
  textInputs.forEach((el) => processElement(el, 'text', fields));
  selects.forEach((el) => processElement(el, 'select', fields));
  autocompletes.forEach((el) => processElement(el, 'select', fields)); // Treat as select
  multiSelects.forEach((el) => processElement(el, 'select', fields)); // Treat as select
  tagsInputs.forEach((el) => processElement(el, 'text', fields)); // Tags are text input
  textareas.forEach((el) => processElement(el, 'textarea', fields));
  checkboxes.forEach((el) => processElement(el, 'checkbox', fields));
  radios.forEach((el) => processElement(el, 'radio', fields));
  switches.forEach((el) => processElement(el, 'switch', fields));
  dateInputs.forEach((el) => processElement(el, 'date', fields));
  timeInputs.forEach((el) => processElement(el, 'text', fields)); // Time as text
  numberInputs.forEach((el) => processElement(el, 'number', fields));
  richTextEditors.forEach((el) => processElement(el, 'richtext', fields));
  fileInputs.forEach((el) => processElement(el, 'file', fields));
  colorInputs.forEach((el) => processElement(el, 'text', fields)); // Color as text

  // Fallback: generic inputs not caught by Mantine selectors
  const genericInputs = document.querySelectorAll(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="file"])'
  );
  genericInputs.forEach((el) => {
    const existing = fields.find((f) => f.selector === buildSelector(el));
    if (!existing) {
      const type = getFieldTypeFromInput(el as HTMLInputElement);
      processElement(el, type, fields);
    }
  });

  // Detect dynamic form sections (repeatable fields)
  detectDynamicForms(fields);

  logger.log(`Found ${fields.length} form fields`);
  return fields;
}

/**
 * Process a single element and add to fields array
 */
function processElement(
  element: Element,
  type: FieldType,
  fields: DetectedField[]
): void {
  const el = element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

  // Skip if already processed (by id match)
  const existingById = el.id && fields.find((f) => f.id === el.id);
  if (existingById) return;

  // Build unique selector
  const selector = buildSelector(el);

  // Skip if selector already exists
  if (fields.find((f) => f.selector === selector)) return;

  // Extract label using multiple strategies
  const { label, source } = extractLabel(el);

  // Get current value
  const currentValue = getCurrentValue(el, type);

  // Get options for select/radio
  const options = type === 'select' ? getSelectOptions(el as HTMLSelectElement) : undefined;

  // Check if required
  const required =
    el.hasAttribute('required') ||
    el.getAttribute('aria-required') === 'true' ||
    el.closest('[data-mantine-required]') !== null;

  // Detect disabled/readonly status
  const isDisabled = el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true';
  const isReadOnly = el.hasAttribute('readonly') || el.getAttribute('aria-readonly') === 'true';

  // Determine fill method
  const { fillMethod, popupTriggerSelector } = determineFillMethod(el, type, isDisabled, isReadOnly);

  const field: DetectedField = {
    id: el.id || generateFieldId(el),
    name: el.name || undefined,
    type,
    label,
    labelSource: source,
    selector,
    required,
    currentValue,
    options,
    isDisabled,
    isReadOnly,
    fillMethod,
    popupTriggerSelector,
  };

  fields.push(field);
}

/**
 * Extract label using multiple strategies in priority order
 */
function extractLabel(element: Element): { label: string; source: LabelSource } {
  const el = element as HTMLInputElement;

  // Strategy 1: Direct aria-label
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) {
    return { label: ariaLabel.trim(), source: 'aria' };
  }

  // Strategy 2: aria-labelledby
  const ariaLabelledBy = el.getAttribute('aria-labelledby');
  if (ariaLabelledBy) {
    const labelEl = document.getElementById(ariaLabelledBy);
    if (labelEl?.textContent) {
      return { label: cleanLabel(labelEl.textContent), source: 'aria' };
    }
  }

  // Strategy 3: Associated <label> by htmlFor
  if (el.id) {
    const associatedLabel = document.querySelector(`label[for="${el.id}"]`);
    if (associatedLabel?.textContent) {
      return { label: cleanLabel(associatedLabel.textContent), source: 'associated' };
    }
  }

  // Strategy 4: Parent label element (Mantine wraps inputs in label)
  const parentLabel = el.closest('label');
  if (parentLabel) {
    const labelText = Array.from(parentLabel.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent?.trim())
      .filter(Boolean)
      .join(' ');
    if (labelText) {
      return { label: cleanLabel(labelText), source: 'associated' };
    }
  }

  // Strategy 5: Mantine InputWrapper label
  const wrapper = el.closest('.mantine-InputWrapper-root, [data-mantine-input-wrapper]');
  if (wrapper) {
    const mantineLabel = wrapper.querySelector(
      '.mantine-InputWrapper-label, .mantine-Input-label'
    );
    if (mantineLabel?.textContent) {
      return { label: cleanLabel(mantineLabel.textContent), source: 'prop' };
    }
  }

  // Strategy 6: Previous sibling with label-like content
  const previousEl = el.previousElementSibling;
  if (previousEl?.textContent && isLikelyLabel(previousEl)) {
    return { label: cleanLabel(previousEl.textContent), source: 'associated' };
  }

  // Strategy 7: Placeholder
  const placeholder = el.getAttribute('placeholder');
  if (placeholder) {
    return { label: placeholder.trim(), source: 'placeholder' };
  }

  // Strategy 8: Name attribute as fallback
  if (el.name) {
    return { label: formatNameAsLabel(el.name), source: 'prop' };
  }

  return { label: 'Unknown Field', source: 'unknown' };
}

/**
 * Build a unique CSS selector for an element
 */
function buildSelector(element: Element): string {
  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }

  const path: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();

    const parent: Element | null = current.parentElement;
    if (parent) {
      const currentEl = current;
      const siblings = Array.from(parent.children).filter(
        (child: Element) => child.tagName === currentEl.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-child(${index})`;
      }
    }

    const mantineClass = Array.from(current.classList).find((c) => c.startsWith('mantine-'));
    if (mantineClass) {
      selector += `.${mantineClass}`;
    }

    path.unshift(selector);
    current = parent;

    if (path.length > 5) break;
  }

  return path.join(' > ');
}

/**
 * Get current value based on field type
 */
function getCurrentValue(
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLElement,
  type: FieldType
): string {
  switch (type) {
    case 'checkbox':
      return (element as HTMLInputElement).checked ? 'true' : 'false';
    case 'radio':
      return (element as HTMLInputElement).checked ? (element as HTMLInputElement).value : '';
    case 'select':
      return (element as HTMLSelectElement).value;
    case 'richtext':
      // Rich text editors use innerHTML or textContent
      return element.innerHTML || element.textContent || '';
    case 'file':
      // File inputs can't retrieve value easily
      return '';
    default:
      return (element as HTMLInputElement).value || '';
  }
}

/**
 * Get options from select element
 */
function getSelectOptions(select: HTMLSelectElement): string[] {
  const wrapper = select.closest('.mantine-Select-root');
  if (wrapper) {
    const options = wrapper.querySelectorAll('[data-combobox-option]');
    if (options.length > 0) {
      return Array.from(options).map((opt) => opt.textContent?.trim() || '');
    }
  }

  return Array.from(select.options).map((opt) => opt.text);
}

/**
 * Determine field type from input element
 */
function getFieldTypeFromInput(input: HTMLInputElement): FieldType {
  switch (input.type) {
    case 'checkbox':
      return 'checkbox';
    case 'radio':
      return 'radio';
    case 'number':
      return 'number';
    case 'date':
    case 'datetime-local':
      return 'date';
    default:
      return 'text';
  }
}

/**
 * Clean label text
 */
function cleanLabel(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\*$/, '')
    .replace(/:\s*$/, '')
    .trim();
}

/**
 * Check if element looks like a label
 */
function isLikelyLabel(element: Element): boolean {
  const tagName = element.tagName.toLowerCase();
  const text = element.textContent?.trim() || '';

  if (text.length === 0 || text.length > 100) return false;

  if (['label', 'span', 'div', 'p', 'dt'].includes(tagName)) {
    return true;
  }

  const hasLabelClass = Array.from(element.classList).some((c) =>
    c.toLowerCase().includes('label')
  );

  return hasLabelClass;
}

/**
 * Format camelCase/snake_case name as label
 */
function formatNameAsLabel(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Generate unique ID for elements without ID
 */
function generateFieldId(element: Element): string {
  const type = element.tagName.toLowerCase();
  const index = Array.from(document.querySelectorAll(type)).indexOf(element);
  return `autofill-${type}-${index}`;
}

/**
 * Determine the appropriate fill method for an element
 */
function determineFillMethod(
  element: HTMLElement,
  _type: FieldType,
  isDisabled: boolean,
  isReadOnly: boolean
): { fillMethod: FillMethod; popupTriggerSelector?: string } {
  // Skip disabled fields entirely
  if (isDisabled) {
    return { fillMethod: 'skip' };
  }

  // Check for file input
  if (element instanceof HTMLInputElement && element.type === 'file') {
    return { fillMethod: 'file' };
  }

  // Check for popup-triggered fields (readonly select/input with click handler or parent click)
  if (isReadOnly) {
    const popupTrigger = findPopupTrigger(element);
    if (popupTrigger) {
      return {
        fillMethod: 'popup',
        popupTriggerSelector: buildSelector(popupTrigger),
      };
    }
    // ReadOnly without popup trigger = computed field
    return { fillMethod: 'computed' };
  }

  // Check for Mantine Select that opens dropdown (may need special handling)
  const mantineSelect = element.closest('.mantine-Select-root');
  if (mantineSelect) {
    // Check if it has onClick that opens a modal (CategoryModal pattern)
    const hasModalTrigger = element.hasAttribute('onclick') ||
      element.closest('[data-modal-trigger]') !== null ||
      isLikelyCategoryField(element);

    if (hasModalTrigger) {
      return {
        fillMethod: 'popup',
        popupTriggerSelector: buildSelector(element),
      };
    }
  }

  // Default to direct fill
  return { fillMethod: 'direct' };
}

/**
 * Find popup trigger element for a readonly field
 */
function findPopupTrigger(element: HTMLElement): HTMLElement | null {
  // Check if element itself has click handler
  if (element.onclick || element.hasAttribute('onclick')) {
    return element;
  }

  // Check parent LabelInput container (common admin pattern)
  const labelInput = element.closest('.mantine-InputWrapper-root, [data-label-input]');
  if (labelInput) {
    // Check if container has onClick
    const container = labelInput as HTMLElement;
    if (container.onclick || container.hasAttribute('onclick')) {
      return container;
    }
  }

  // Check immediate parent
  const parent = element.parentElement;
  if (parent && (parent.onclick || parent.hasAttribute('onclick'))) {
    return parent;
  }

  return null;
}

/**
 * Heuristic to detect category-like fields that use modal selection
 */
function isLikelyCategoryField(element: HTMLElement): boolean {
  const label = extractLabel(element).label.toLowerCase();
  const categoryKeywords = ['category', 'カテゴリ', '카테고리', '분류', '类别'];
  return categoryKeywords.some((keyword) => label.includes(keyword));
}

/**
 * Detect and mark dynamic form sections (repeatable/marketplace fields)
 */
function detectDynamicForms(fields: DetectedField[]): void {
  // Find dynamic input pattern (dynamic-{market}-{field})
  const dynamicInputs = document.querySelectorAll(MANTINE_SELECTORS.dynamicInput);

  dynamicInputs.forEach((el) => {
    const name = el.getAttribute('name') || '';
    // Parse pattern: dynamic-{marketName}-{fieldName}
    const match = name.match(/^dynamic-([^-]+)-(.+)$/);
    if (!match) return;

    const [, marketName, fieldName] = match;

    // Check if already processed
    const existing = fields.find((f) => f.name === name);
    if (existing) {
      // Mark as dynamic field
      existing.type = 'dynamic';
      return;
    }

    // Add as new field
    const inputEl = el as HTMLInputElement;
    const label = `${marketName}: ${fieldName.replace(/-/g, ' ')}`;

    fields.push({
      id: name,
      name,
      type: 'dynamic',
      label,
      labelSource: 'prop',
      selector: `[name="${name}"]`,
      required: inputEl.hasAttribute('required'),
      currentValue: inputEl.value || '',
      isDisabled: inputEl.disabled,
      isReadOnly: inputEl.readOnly,
      fillMethod: inputEl.disabled ? 'skip' : 'direct',
    });
  });
}
