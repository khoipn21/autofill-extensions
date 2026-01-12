import type {
  ExtensionMessage,
  ExtensionResponse,
  DetectedField,
  AIFillResult,
  FieldType,
} from '@/shared/types';
import { getSettings } from '@/shared/storage';
import { logger } from '@/utils/logger';
import { isAllowedUrl } from '@/utils/validators';
import { analyzeFormFields } from './dom-analyzer';
import { fillFormFields, highlightField } from './form-filler';
import { initOverlay, setOverlayState, showToast, updateDebugStream } from './ui-overlay';
import { initKeyboardShortcuts, registerShortcut } from './keyboard-shortcuts';

// Initialize content script based on settings
initializeWithSettings();

async function initializeWithSettings() {
  const settings = await getSettings();
  const url = window.location.href;

  // Check if extension is enabled and URL is allowed
  if (!settings.enabled) {
    logger.log('Extension is disabled');
    return;
  }

  if (!isAllowedUrl(url, settings.customDomains, settings.enabled)) {
    logger.log('URL not in allowed domains, content script inactive');
    return;
  }

  logger.log('Content script loaded on allowed page');
  initContentScript();
}

function initContentScript() {
  // Pass triggerAutoFill callback and cancel handler to overlay
  initOverlay(triggerAutoFill, handleCancelRequest);
  initKeyboardShortcuts();

  registerShortcut({
    key: 'f',
    alt: true,
    handler: triggerAutoFill,
    description: 'Trigger auto-fill',
  });

  // Cancel shortcut (Escape key)
  registerShortcut({
    key: 'Escape',
    handler: async () => {
      handleCancelRequest();
    },
    description: 'Cancel auto-fill',
  });

  chrome.runtime.onMessage.addListener(
    (
      message: ExtensionMessage,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response: ExtensionResponse) => void
    ) => {
      handleMessage(message)
        .then(sendResponse)
        .catch((error) => {
          logger.error('Content script error:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true;
    }
  );
}

async function handleMessage(message: ExtensionMessage): Promise<ExtensionResponse> {
  switch (message.type) {
    case 'GET_FORM_FIELDS':
      return handleGetFormFields();

    case 'FILL_FORM':
      return handleFillForm(message.payload as { fields: DetectedField[]; values: AIFillResult });

    case 'TRIGGER_AUTOFILL':
      await triggerAutoFill();
      return { success: true };

    case 'CHANGE_LANGUAGE':
      return handleChangeLanguage(message.payload as { language: 'kr' | 'en' });

    case 'DEBUG_STREAM':
      return handleDebugStream(message.payload as { chunk: string; fullText: string });

    default:
      return { success: false, error: `Unknown message type: ${message.type}` };
  }
}

function handleGetFormFields(): ExtensionResponse<DetectedField[]> {
  try {
    const fields = analyzeFormFields();
    return { success: true, data: fields };
  } catch (error) {
    logger.error('Form analysis failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Analysis failed',
    };
  }
}

async function handleFillForm(payload: {
  fields: DetectedField[];
  values: AIFillResult;
  enabledFieldTypes?: FieldType[];
}): Promise<ExtensionResponse> {
  try {
    const { fields, values, enabledFieldTypes } = payload;

    logger.log('Filling form with values:', values);

    const results = await fillFormFields(fields, values, { enabledFieldTypes });

    for (const result of results) {
      const field = fields.find((f) => f.id === result.fieldId);
      if (field) {
        highlightField(field, result.success);
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    logger.log(`Fill complete: ${successCount} success, ${failCount} failed`);

    if (failCount === 0) {
      showToast(`Filled ${successCount} fields successfully!`, 'success');
    } else {
      showToast(`Filled ${successCount}, failed ${failCount}`, 'error');
    }

    return {
      success: true,
      data: { totalFields: results.length, successCount, failCount, results },
    };
  } catch (error) {
    logger.error('Form fill failed:', error);
    showToast('Form fill failed', 'error');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Fill failed',
    };
  }
}

/**
 * Trigger auto-fill from FAB button or keyboard shortcut
 * Includes recheck loop to verify all fields are filled
 * Supports optional vision-based recheck using full-page screenshot
 */
async function triggerAutoFill(): Promise<void> {
  try {
    setOverlayState({ isLoading: true, message: 'Detecting fields...' });

    // Get settings for enabled field types, vision recheck option, and max fill rounds
    const settings = await getSettings();
    const enabledFieldTypes = settings.enabledFieldTypes;
    const enableVisionRecheck = settings.enableVisionRecheck ?? false;
    const maxFillRounds = settings.maxFillRounds ?? 3; // Default 3 if not set

    let fields = analyzeFormFields();

    if (fields.length === 0) {
      showToast('No form fields found', 'error');
      setOverlayState({ isLoading: false, message: '' });
      return;
    }

    let totalFilledCount = 0;
    let lastFailedCount = 0;

    for (let round = 1; round <= maxFillRounds; round++) {
      const isRecheckRound = round > 1;
      const useVision = isRecheckRound && enableVisionRecheck;

      setOverlayState({
        isLoading: true,
        message: round === 1
          ? `Found ${fields.length} fields, analyzing...`
          : useVision
            ? `Round ${round}: Vision recheck (${fields.length} fields)...`
            : `Round ${round}: Re-analyzing ${fields.length} unfilled fields...`,
      });

      // For vision recheck, take a full-page screenshot
      let screenshot: string | undefined;
      if (useVision) {
        setOverlayState({
          isLoading: true,
          message: `Round ${round}: Taking screenshot for vision analysis...`,
        });

        try {
          const screenshotResponse = await chrome.runtime.sendMessage({
            type: 'TAKE_SCREENSHOT',
          });
          if (screenshotResponse.success && screenshotResponse.data) {
            screenshot = screenshotResponse.data;
            logger.log('Vision recheck: Screenshot captured');
          }
        } catch (err) {
          logger.warn('Failed to take screenshot for vision recheck:', err);
        }
      }

      // Request AI to analyze form (with optional screenshot for vision recheck)
      const response = await chrome.runtime.sendMessage({
        type: 'ANALYZE_FORM',
        payload: {
          url: window.location.href,
          fields,
          screenshot, // Include screenshot for vision-based analysis
          timestamp: Date.now(),
          isVisionRecheck: useVision, // Flag for AI to focus on unfilled fields
        },
      });

      if (!response.success) {
        throw new Error(response.error || 'AI analysis failed');
      }

      setOverlayState({
        isLoading: true,
        message: round === 1 ? 'Filling form...' : `Round ${round}: Filling remaining fields...`,
      });

      const fillResult = await handleFillForm({ fields, values: response.data, enabledFieldTypes });

      if (!fillResult.success) {
        throw new Error(fillResult.error || 'Fill failed');
      }

      const resultData = fillResult.data as {
        totalFields: number;
        successCount: number;
        failCount: number;
        results: Array<{ fieldId: string; success: boolean; skipped?: boolean; error?: string }>;
      };

      totalFilledCount += resultData.successCount;

      // Get failed and not-skipped fields for retry
      const failedFieldIds = resultData.results
        .filter((r) => !r.success && !r.skipped)
        .map((r) => r.fieldId);

      logger.log(`Round ${round}: ${resultData.successCount} filled, ${failedFieldIds.length} failed`);

      // If no failures or all were skipped, we're done
      if (failedFieldIds.length === 0) {
        showToast(`Filled ${totalFilledCount} fields successfully!`, 'success');
        break;
      }

      // If same number of failures as last round, stop to avoid infinite loop
      if (failedFieldIds.length === lastFailedCount) {
        logger.warn(`Same number of failures (${failedFieldIds.length}), stopping retry loop`);
        showToast(
          `Filled ${totalFilledCount} fields, ${failedFieldIds.length} could not be filled`,
          failedFieldIds.length > 0 ? 'error' : 'success'
        );
        break;
      }

      lastFailedCount = failedFieldIds.length;

      // If we've reached max rounds, stop
      if (round >= maxFillRounds) {
        showToast(
          `Filled ${totalFilledCount} fields after ${round} rounds, ${failedFieldIds.length} remaining`,
          'error'
        );
        break;
      }

      // Re-analyze only the unfilled fields for next round
      setOverlayState({
        isLoading: true,
        message: `Rechecking ${failedFieldIds.length} unfilled fields...`,
      });

      // Wait for any async updates (API-loaded selects, dynamic fields)
      await sleep(500);

      // Re-detect fields from DOM (they may have changed)
      const freshFields = analyzeFormFields();

      // Filter to only unfilled fields
      fields = freshFields.filter((f) => {
        // Check if field was in failed list
        if (failedFieldIds.includes(f.id)) return true;

        // Also check if field has no current value (may be newly rendered)
        if (!f.currentValue || f.currentValue === '' || f.currentValue === '(empty)') {
          // Only include if it's an enabled field type and not skippable
          if (f.fillMethod !== 'skip' && f.fillMethod !== 'computed' && f.fillMethod !== 'file') {
            if (!enabledFieldTypes || enabledFieldTypes.includes(f.type)) {
              return true;
            }
          }
        }

        return false;
      });

      if (fields.length === 0) {
        showToast(`Filled ${totalFilledCount} fields successfully!`, 'success');
        break;
      }

      logger.log(`Retrying with ${fields.length} unfilled fields`);
    }
  } catch (error) {
    logger.error('Auto-fill failed:', error);
    showToast(error instanceof Error ? error.message : 'Auto-fill failed', 'error');
  } finally {
    setOverlayState({ isLoading: false, message: '' });
  }
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Handle language change request from popup
 * Changes the site language immediately by calling i18next directly
 */
function handleChangeLanguage(payload: { language: 'kr' | 'en' }): ExtensionResponse {
  try {
    const { language } = payload;

    // Set language in localStorage for persistence
    localStorage.setItem('language', language);

    // Call i18next directly via window object (Daun Admin exposes it)
    // Inject script to access React app's i18n instance
    const script = document.createElement('script');
    script.textContent = `
      (function() {
        // Try to change language via i18next global
        if (window.i18next) {
          window.i18next.changeLanguage('${language}');
          return;
        }

        // Try to find i18n instance in React DevTools hook
        if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
          const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
          // Dispatch custom event that app can listen to
          window.dispatchEvent(new CustomEvent('daun-language-change', { detail: { language: '${language}' } }));
        }

        // Fallback: dispatch storage event to trigger re-render
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'language',
          newValue: '${language}',
          storageArea: localStorage
        }));
      })();
    `;
    document.documentElement.appendChild(script);
    script.remove();

    logger.log(`Language changed to: ${language}`);
    showToast(`Language: ${language === 'kr' ? '한국어' : 'English'}`, 'success');

    return { success: true };
  } catch (error) {
    logger.error('Failed to change language:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to change language',
    };
  }
}

/**
 * Handle debug stream message - update debug panel with AI output
 */
function handleDebugStream(payload: { chunk: string; fullText: string }): ExtensionResponse {
  try {
    updateDebugStream(payload.chunk, payload.fullText);
    return { success: true };
  } catch (error) {
    logger.error('Debug stream update failed:', error);
    return { success: false, error: 'Debug stream failed' };
  }
}

/**
 * Handle cancel request - cancel running AI analysis
 */
function handleCancelRequest(): void {
  logger.log('Cancel request triggered');

  // Send cancel message to background script
  chrome.runtime.sendMessage({ type: 'CANCEL_REQUEST' })
    .then((response) => {
      if (response?.success && response?.data?.cancelled) {
        showToast('Request cancelled', 'error');
        setOverlayState({ isLoading: false, message: '' });
      }
    })
    .catch((err) => {
      logger.warn('Cancel request failed:', err);
    });
}
