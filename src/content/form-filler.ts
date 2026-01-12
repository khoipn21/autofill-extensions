import type { DetectedField, AIFillResult, FieldType } from '@/shared/types';
import { logger } from '@/utils/logger';
import { fillPopupField } from './popup-handler';

interface FillResult {
  fieldId: string;
  success: boolean;
  skipped?: boolean;
  reason?: string;
  error?: string;
}

interface FillOptions {
  enabledFieldTypes?: FieldType[];
  delayBetweenFields?: number; // Delay in ms between filling each field (for API-loaded selects)
}

/**
 * Fill form fields with AI-generated values
 */
export async function fillFormFields(
  fields: DetectedField[],
  values: AIFillResult,
  options: FillOptions = {}
): Promise<FillResult[]> {
  const results: FillResult[] = [];
  const { enabledFieldTypes, delayBetweenFields = 300 } = options; // Default 300ms delay

  for (const field of fields) {
    const value = values[field.id];

    // Skip fields with no value to fill
    if (value === undefined || value === null) {
      results.push({
        fieldId: field.id,
        success: true,
        skipped: true,
        reason: 'No value provided',
      });
      continue;
    }

    // Skip field types not in enabled list
    if (enabledFieldTypes && !enabledFieldTypes.includes(field.type)) {
      results.push({
        fieldId: field.id,
        success: true,
        skipped: true,
        reason: `Field type "${field.type}" not enabled`,
      });
      logger.log(`Skipped field type not enabled: ${field.id} (${field.type})`);
      continue;
    }

    // Skip disabled fields
    if (field.fillMethod === 'skip' || field.isDisabled) {
      results.push({
        fieldId: field.id,
        success: true,
        skipped: true,
        reason: 'Field is disabled',
      });
      logger.log(`Skipped disabled field: ${field.id}`);
      continue;
    }

    // Skip computed/readonly fields
    if (field.fillMethod === 'computed') {
      results.push({
        fieldId: field.id,
        success: true,
        skipped: true,
        reason: 'Field is computed/auto-generated',
      });
      logger.log(`Skipped computed field: ${field.id}`);
      continue;
    }

    // Skip file inputs (can't auto-fill files)
    if (field.fillMethod === 'file' || field.type === 'file') {
      results.push({
        fieldId: field.id,
        success: true,
        skipped: true,
        reason: 'File inputs cannot be auto-filled',
      });
      logger.log(`Skipped file input: ${field.id}`);
      continue;
    }

    try {
      // Handle popup fields
      if (field.fillMethod === 'popup') {
        const success = await fillPopupField(field, value);
        results.push({
          fieldId: field.id,
          success,
          error: success ? undefined : 'Popup selection failed',
        });
        // Add delay between fields for API-loaded data
        await sleep(delayBetweenFields);
        continue;
      }

      // Handle direct fill
      const element = findElement(field);
      if (!element) {
        throw new Error('Element not found');
      }

      await fillElement(element, field.type, value);

      results.push({ fieldId: field.id, success: true });
      logger.log(`Filled ${field.id}: ${value}`);

      // Add delay between fields for API-loaded data (e.g., dependent selects)
      await sleep(delayBetweenFields);
    } catch (error) {
      logger.error(`Failed to fill ${field.id}:`, error);
      results.push({
        fieldId: field.id,
        success: false,
        error: error instanceof Error ? error.message : 'Fill failed',
      });
    }
  }

  return results;
}

/**
 * Find element using stored selector
 */
function findElement(field: DetectedField): HTMLElement | null {
  if (field.id && !field.id.startsWith('autofill-')) {
    const byId = document.getElementById(field.id);
    if (byId) return byId;
  }

  try {
    const bySelector = document.querySelector(field.selector);
    if (bySelector) return bySelector as HTMLElement;
  } catch {
    // Invalid selector, continue
  }

  if (field.name) {
    const byName = document.querySelector(`[name="${field.name}"]`);
    if (byName) return byName as HTMLElement;
  }

  return null;
}

/**
 * Fill a single element based on its type
 */
async function fillElement(
  element: HTMLElement,
  type: string,
  value: string
): Promise<void> {
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await sleep(100);

  element.focus();
  await sleep(50);

  switch (type) {
    case 'text':
    case 'textarea':
    case 'dynamic': // Dynamic marketplace fields are usually text inputs
      await fillTextInput(element as HTMLInputElement | HTMLTextAreaElement, value);
      break;

    case 'number':
      await fillNumberInput(element as HTMLInputElement, value);
      break;

    case 'date':
      await fillDateInput(element as HTMLInputElement, value);
      break;

    case 'select':
      await fillSelect(element, value);
      break;

    case 'checkbox':
      fillCheckbox(element as HTMLInputElement, value);
      break;

    case 'switch':
      await fillSwitch(element as HTMLInputElement, value);
      break;

    case 'radio':
      fillRadio(element as HTMLInputElement, value);
      break;

    case 'richtext':
      await fillRichText(element, value);
      break;

    default:
      await fillTextInput(element as HTMLInputElement, value);
  }

  element.blur();
}

/**
 * Fill text input with React-compatible event simulation
 */
async function fillTextInput(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string
): Promise<void> {
  element.value = '';

  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    element instanceof HTMLInputElement
      ? HTMLInputElement.prototype
      : HTMLTextAreaElement.prototype,
    'value'
  )?.set;

  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(element, value);
  } else {
    element.value = value;
  }

  element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
  element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));

  element.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: value,
    })
  );

  await sleep(50);
}

/**
 * Fill number input (handles Mantine NumberInput)
 */
async function fillNumberInput(element: HTMLInputElement, value: string): Promise<void> {
  const numValue = parseFloat(value) || 0;

  // Check for Mantine NumberInput
  const mantineWrapper = element.closest('.mantine-NumberInput-root');

  if (mantineWrapper) {
    // Clear the input first
    element.value = '';

    // Use native setter for React compatibility
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(element, numValue.toString());
    } else {
      element.value = numValue.toString();
    }

    // Dispatch events
    element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));

    // Trigger blur to finalize (Mantine updates on blur)
    element.dispatchEvent(new Event('blur', { bubbles: true }));
  } else {
    // Standard number input
    await fillTextInput(element, numValue.toString());
  }

  await sleep(50);
}

/**
 * Fill date input (handles Mantine DatePickerInput/DateInput)
 */
async function fillDateInput(element: HTMLInputElement, value: string): Promise<void> {
  // Normalize date format to YYYY-MM-DD
  let dateStr = value;
  if (value.includes('/')) {
    // Convert MM/DD/YYYY or DD/MM/YYYY to YYYY-MM-DD
    const parts = value.split('/');
    if (parts.length === 3) {
      dateStr = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
    }
  }

  // Check for Mantine DatePicker (v7 and v8 selectors)
  const mantineDatePicker = element.closest(
    '.mantine-DatePickerInput-root, .mantine-DateInput-root, ' +
    '[class*="DatePickerInput"], [class*="DateInput"]'
  );

  if (mantineDatePicker) {
    // For Mantine 8.x, we need to trigger calendar and select date
    // First, try clicking the input to open the calendar popover
    const inputWrapper = mantineDatePicker.querySelector('.mantine-DatePickerInput-input, .mantine-DateInput-input, input');
    if (inputWrapper) {
      (inputWrapper as HTMLElement).click();
      await sleep(300);
    } else {
      element.click();
      await sleep(300);
    }

    // Look for calendar popover (Mantine 8.x uses Popover)
    // Wait for calendar to fully render
    let calendar: Element | null = null;
    for (let waited = 0; waited < 500; waited += 100) {
      const popover = document.querySelector('[data-floating-ui-portal], .mantine-Popover-dropdown');
      calendar = popover?.querySelector('[class*="Calendar"], [class*="DatePicker-calendar"]') ||
                 document.querySelector('.mantine-Calendar-calendar, [class*="Calendar-month"]');
      if (calendar) break;
      await sleep(100);
    }

    if (calendar) {
      const success = await selectDateInCalendar(calendar as HTMLElement, dateStr);
      if (success) {
        await sleep(100);
        // Close popover by pressing Escape or clicking outside
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await sleep(100);
        return;
      }
    }

    // Fallback: close any open calendar first
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await sleep(100);

    // Try direct input with formatted date for Korean locale (YYYY년 MM월 DD일)
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const koreanFormat = `${date.getFullYear()}년 ${String(date.getMonth() + 1).padStart(2, '0')}월 ${String(date.getDate()).padStart(2, '0')}일`;

      element.focus();
      await sleep(50);
      element.value = '';

      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value'
      )?.set;

      // Try Korean format first, then ISO format
      const formatsToTry = [koreanFormat, dateStr, date.toLocaleDateString('ko-KR')];

      for (const format of formatsToTry) {
        if (nativeInputValueSetter) {
          nativeInputValueSetter.call(element, format);
        } else {
          element.value = format;
        }

        element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        element.dispatchEvent(new Event('blur', { bubbles: true }));

        await sleep(100);

        // Check if value was accepted (not cleared)
        if (element.value && element.value !== '') {
          logger.log(`Date filled with format: ${format}`);
          return;
        }
      }
    }
  } else {
    // Standard HTML5 date input
    await fillTextInput(element, dateStr);
  }

  await sleep(50);
}

/**
 * Select date in Mantine calendar (v7 and v8 compatible)
 * Simplified approach: navigate to correct month then click day
 */
async function selectDateInCalendar(calendar: HTMLElement, dateStr: string): Promise<boolean> {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;

  const targetYear = date.getFullYear();
  const targetMonth = date.getMonth(); // 0-indexed
  const targetDay = date.getDate();

  // Try to navigate to the correct month first
  // Look for the header that shows current month/year
  const headerLevel = calendar.querySelector(
    '[class*="calendarHeaderLevel"], [class*="CalendarHeader"] button, ' +
    '.mantine-DatePicker-calendarHeaderLevel, .mantine-Calendar-calendarHeaderLevel'
  );

  if (headerLevel) {
    // Get current displayed month/year from header
    const headerText = headerLevel.textContent?.trim() || '';
    logger.log(`Calendar header: ${headerText}`);

    // Navigate using prev/next buttons to get to correct month
    const prevBtn = calendar.querySelector('[class*="calendarHeaderControl"]:first-child, [data-previous], [aria-label*="Previous"]');
    const nextBtn = calendar.querySelector('[class*="calendarHeaderControl"]:last-child, [data-next], [aria-label*="Next"]');

    // Simple navigation: use prev/next buttons to reach target month
    let attempts = 0;
    const maxAttempts = 24; // 2 years worth of months

    while (attempts < maxAttempts) {
      // Check if we can find the target day button
      const dayButtons = calendar.querySelectorAll(
        '[class*="Day-day"], [data-date], .mantine-DatePicker-day, .mantine-Calendar-day, ' +
        'button[class*="day"]:not([class*="outside"])'
      );

      for (const btn of dayButtons) {
        const dataDate = btn.getAttribute('data-date');
        const dayText = btn.textContent?.trim();
        const isOutside = btn.getAttribute('data-outside') === 'true' ||
                          btn.classList.contains('mantine-DatePicker-day--outside') ||
                          btn.hasAttribute('data-outside');

        // Check if this button matches our target date
        if (dataDate === dateStr) {
          (btn as HTMLElement).click();
          logger.log(`Selected date by data-date: ${dateStr}`);
          return true;
        }

        // Check day number matches and not outside current month
        if (!isOutside && dayText === targetDay.toString()) {
          // Verify we're in the correct month by checking header
          const currentHeader = calendar.querySelector(
            '[class*="calendarHeaderLevel"], .mantine-DatePicker-calendarHeaderLevel'
          );
          const currentHeaderText = currentHeader?.textContent?.toLowerCase() || '';

          // Check if header contains target month name
          const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
                              'july', 'august', 'september', 'october', 'november', 'december',
                              '1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
          const targetMonthName = monthNames[targetMonth]?.toLowerCase();
          const targetMonthKr = monthNames[targetMonth + 12];

          if (currentHeaderText.includes(targetYear.toString()) &&
              (currentHeaderText.includes(targetMonthName) || currentHeaderText.includes(targetMonthKr))) {
            (btn as HTMLElement).click();
            logger.log(`Selected date by day number: ${targetDay}`);
            return true;
          }
        }
      }

      // Need to navigate - determine direction
      const currentHeader = calendar.querySelector('[class*="calendarHeaderLevel"]');
      const currentText = currentHeader?.textContent || '';

      // Parse current month/year from header (e.g., "January 2025" or "2025년 1월")
      const yearMatch = currentText.match(/\d{4}/);
      const currentYear = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();

      // Determine if we need to go forward or backward
      const currentMonthIndex = getMonthIndexFromHeader(currentText);
      const currentDate = new Date(currentYear, currentMonthIndex, 1);
      const targetDate = new Date(targetYear, targetMonth, 1);

      if (currentDate < targetDate && nextBtn) {
        (nextBtn as HTMLElement).click();
        await sleep(150);
      } else if (currentDate > targetDate && prevBtn) {
        (prevBtn as HTMLElement).click();
        await sleep(150);
      } else {
        // We're in the right month, try clicking the day again
        const dayButtons = calendar.querySelectorAll('[class*="Day-day"], [data-date], button[class*="day"]');
        for (const btn of dayButtons) {
          const isOutside = btn.getAttribute('data-outside') === 'true';
          const dayText = btn.textContent?.trim();
          if (!isOutside && dayText === targetDay.toString()) {
            (btn as HTMLElement).click();
            logger.log(`Selected date on final attempt: ${targetDay}`);
            return true;
          }
        }
        break;
      }

      attempts++;
    }
  }

  // Fallback: try clicking any visible day button that matches
  const allDayButtons = calendar.querySelectorAll('button');
  for (const btn of allDayButtons) {
    const dayText = btn.textContent?.trim();
    if (dayText === targetDay.toString() && !btn.hasAttribute('data-outside')) {
      (btn as HTMLElement).click();
      logger.log(`Selected date via fallback: ${targetDay}`);
      return true;
    }
  }

  return false;
}

/**
 * Get month index (0-11) from calendar header text
 */
function getMonthIndexFromHeader(headerText: string): number {
  const text = headerText.toLowerCase();

  // English month names
  const englishMonths = ['january', 'february', 'march', 'april', 'may', 'june',
                         'july', 'august', 'september', 'october', 'november', 'december'];
  for (let i = 0; i < englishMonths.length; i++) {
    if (text.includes(englishMonths[i])) return i;
  }

  // Korean month names (1월, 2월, etc.)
  const koreanMatch = text.match(/(\d+)월/);
  if (koreanMatch) {
    return parseInt(koreanMatch[1]) - 1;
  }

  return new Date().getMonth();
}

/**
 * Fill Mantine Select component
 */
async function fillSelect(element: HTMLElement, value: string): Promise<void> {
  const mantineWrapper = element.closest('.mantine-Select-root');

  if (mantineWrapper) {
    await fillMantineSelect(mantineWrapper as HTMLElement, value);
  } else if (element instanceof HTMLSelectElement) {
    fillNativeSelect(element, value);
  }
}

/**
 * Fill Mantine Select by clicking and selecting option
 * Includes retry logic for API-loaded options
 */
async function fillMantineSelect(wrapper: HTMLElement, value: string): Promise<void> {
  const input = wrapper.querySelector('.mantine-Select-input') as HTMLElement;
  if (!input) {
    throw new Error('Mantine Select input not found');
  }

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Click to open dropdown
      input.click();
      await sleep(200);

      // Wait for dropdown to appear (may need to load from API)
      let dropdown: Element | null = null;
      const dropdownWaitTime = attempt * 500; // Increase wait time on retries

      for (let waited = 0; waited < dropdownWaitTime; waited += 100) {
        dropdown = document.querySelector('.mantine-Select-dropdown, [data-combobox-dropdown]');
        if (dropdown) break;
        await sleep(100);
      }

      if (!dropdown) {
        throw new Error('Mantine Select dropdown not found');
      }

      // Wait for options to load (API calls may take time)
      let options: NodeListOf<Element> | null = null;
      const optionsWaitTime = attempt * 800; // Longer wait for API-loaded options

      for (let waited = 0; waited < optionsWaitTime; waited += 150) {
        options = dropdown.querySelectorAll('[data-combobox-option]');
        if (options && options.length > 0) break;
        await sleep(150);
      }

      if (!options || options.length === 0) {
        // Close dropdown and retry
        document.body.click();
        await sleep(100);
        throw new Error('No options available in dropdown');
      }

      // Find matching option (case-insensitive, partial match)
      let matchedOption: HTMLElement | null = null;
      const valueLower = value.toLowerCase().trim();

      for (const opt of options) {
        const optText = opt.textContent?.trim().toLowerCase() || '';
        const optValue = opt.getAttribute('data-value')?.toLowerCase() || '';

        // Exact match first
        if (optText === valueLower || optValue === valueLower) {
          matchedOption = opt as HTMLElement;
          break;
        }
      }

      // Partial match if no exact match
      if (!matchedOption) {
        for (const opt of options) {
          const optText = opt.textContent?.trim().toLowerCase() || '';
          if (optText.includes(valueLower) || valueLower.includes(optText)) {
            matchedOption = opt as HTMLElement;
            break;
          }
        }
      }

      if (matchedOption) {
        matchedOption.click();
        await sleep(150);
        return; // Success!
      }

      // Close dropdown before retry
      document.body.click();
      await sleep(100);
      throw new Error(`Option "${value}" not found in select (${options.length} options available)`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.warn(`Select fill attempt ${attempt} failed:`, lastError.message);

      if (attempt < maxRetries) {
        await sleep(300 * attempt); // Exponential backoff
      }
    }
  }

  // Close any open dropdown
  document.body.click();
  throw lastError || new Error(`Failed to fill select with value: ${value}`);
}

/**
 * Fill native HTML select element
 */
function fillNativeSelect(select: HTMLSelectElement, value: string): void {
  const option = Array.from(select.options).find(
    (opt) =>
      opt.value.toLowerCase() === value.toLowerCase() ||
      opt.text.toLowerCase() === value.toLowerCase()
  );

  if (option) {
    select.value = option.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    throw new Error(`Option "${value}" not found`);
  }
}

/**
 * Fill checkbox element
 */
function fillCheckbox(element: HTMLInputElement, value: string): void {
  const shouldCheck =
    value.toLowerCase() === 'true' || value === '1' || value.toLowerCase() === 'yes';

  if (element.checked !== shouldCheck) {
    element.click();
  }
}

/**
 * Fill Mantine Switch component
 */
async function fillSwitch(element: HTMLInputElement, value: string): Promise<void> {
  const shouldCheck =
    value.toLowerCase() === 'true' || value === '1' || value.toLowerCase() === 'yes';

  // Mantine Switch uses hidden input + track element
  const switchWrapper = element.closest('.mantine-Switch-root');

  if (switchWrapper) {
    // Find the track element which handles the click
    const track = switchWrapper.querySelector('.mantine-Switch-track') as HTMLElement;

    if (track && element.checked !== shouldCheck) {
      track.click();
      await sleep(100);
    }
  } else {
    // Fallback to checkbox behavior
    if (element.checked !== shouldCheck) {
      element.click();
    }
  }
}

/**
 * Fill radio button
 */
function fillRadio(element: HTMLInputElement, value: string): void {
  const name = element.name;
  if (!name) {
    element.click();
    return;
  }

  const radios = document.querySelectorAll(`input[type="radio"][name="${name}"]`);
  for (const radio of radios) {
    const r = radio as HTMLInputElement;
    if (r.value.toLowerCase() === value.toLowerCase()) {
      r.click();
      return;
    }
  }

  element.click();
}

/**
 * Fill rich text editor (Quill, TipTap, ProseMirror, contenteditable)
 */
async function fillRichText(element: HTMLElement, value: string): Promise<void> {
  // Check for Quill editor (.ql-editor)
  const quillEditor = element.classList.contains('ql-editor')
    ? element
    : element.querySelector('.ql-editor');

  if (quillEditor) {
    await fillQuillEditor(quillEditor as HTMLElement, value);
    return;
  }

  // Check for TipTap/ProseMirror
  const proseMirror = element.classList.contains('ProseMirror')
    ? element
    : element.querySelector('.ProseMirror');

  if (proseMirror) {
    await fillProseMirror(proseMirror as HTMLElement, value);
    return;
  }

  // Generic contenteditable
  if (element.getAttribute('contenteditable') === 'true') {
    await fillContentEditable(element, value);
    return;
  }

  // Fallback: try to find any editable child
  const editableChild = element.querySelector('[contenteditable="true"]');
  if (editableChild) {
    await fillContentEditable(editableChild as HTMLElement, value);
  }
}

/**
 * Fill Quill editor
 */
async function fillQuillEditor(editor: HTMLElement, value: string): Promise<void> {
  // Clear existing content
  editor.innerHTML = '';

  // Set new content as HTML (Quill uses delta but innerHTML works for display)
  const htmlValue = value.startsWith('<') ? value : `<p>${value}</p>`;
  editor.innerHTML = htmlValue;

  // Trigger input event for React/Vue bindings
  editor.dispatchEvent(new Event('input', { bubbles: true }));
  editor.dispatchEvent(new Event('change', { bubbles: true }));

  // Try to trigger Quill's text-change event
  const quillContainer = editor.closest('.quill, .ql-container');
  if (quillContainer) {
    quillContainer.dispatchEvent(new Event('text-change', { bubbles: true }));
  }

  await sleep(100);
}

/**
 * Fill ProseMirror/TipTap editor
 */
async function fillProseMirror(editor: HTMLElement, value: string): Promise<void> {
  // Focus and clear
  editor.focus();
  await sleep(50);

  // Select all and delete
  document.execCommand('selectAll', false);
  document.execCommand('delete', false);

  // Insert new content
  const htmlValue = value.startsWith('<') ? value : `<p>${value}</p>`;
  document.execCommand('insertHTML', false, htmlValue);

  // Dispatch events
  editor.dispatchEvent(new Event('input', { bubbles: true }));
  editor.dispatchEvent(new Event('change', { bubbles: true }));

  await sleep(100);
}

/**
 * Fill generic contenteditable element
 */
async function fillContentEditable(element: HTMLElement, value: string): Promise<void> {
  element.focus();
  await sleep(50);

  // Clear and set content
  element.innerHTML = value.startsWith('<') ? value : `<p>${value}</p>`;

  // Dispatch events
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));

  await sleep(100);
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Highlight filled fields for visual feedback
 */
export function highlightField(field: DetectedField, success: boolean): void {
  const element = findElement(field);
  if (!element) return;

  const originalOutline = element.style.outline;
  const originalTransition = element.style.transition;

  element.style.transition = 'outline 0.3s ease';
  element.style.outline = success ? '2px solid #40c057' : '2px solid #fa5252';

  setTimeout(() => {
    element.style.outline = originalOutline;
    element.style.transition = originalTransition;
  }, 2000);
}
