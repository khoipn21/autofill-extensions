import { getSettings } from "@/shared/storage";
import type {
  AIFillResult,
  DetectedField,
  ExtensionMessage,
  ExtensionResponse,
  FieldType,
} from "@/shared/types";
import { logger } from "@/utils/logger";
import {
  hideCancelButton,
  initCircularMenu,
  setMenuLoading,
  showCancelButton,
  showMenuToast,
  updateMenuDebugStream,
} from "./circular-menu";
import { analyzeFormFields } from "./dom-analyzer";
import { fillFormFields, highlightField } from "./form-filler";
import { initKeyboardShortcuts, registerShortcut } from "./keyboard-shortcuts";
import { openSettingsModal } from "./settings-modal";

// Initialize content script based on settings
initializeWithSettings();

async function initializeWithSettings() {
  const settings = await getSettings();

  // Only check if extension is globally enabled
  if (!settings.enabled) {
    return;
  }

  initContentScript();
}

function initContentScript() {
  // Initialize circular menu with menu items
  initCircularMenu([
    {
      id: "autofill",
      icon: getAutoFillIcon(),
      label: "Auto-Fill (Alt+F)",
      onClick: () => triggerAutoFill(),
      color: "rgba(34, 197, 94, 0.8)", // Green
    },
    {
      id: "language",
      icon: getLangIcon(),
      label: "Toggle Language",
      onClick: () => toggleLanguage(),
      color: "rgba(168, 85, 247, 0.8)", // Purple
    },
    {
      id: "settings",
      icon: getSettingsIcon(),
      label: "Open Settings",
      onClick: () => openSettings(),
      color: "rgba(59, 130, 246, 0.8)", // Blue
    },
  ]);

  initKeyboardShortcuts();

  registerShortcut({
    key: "f",
    alt: true,
    handler: triggerAutoFill,
    description: "Trigger auto-fill",
  });

  // Cancel shortcut (Escape key)
  registerShortcut({
    key: "Escape",
    handler: async () => {
      handleCancelRequest();
    },
    description: "Cancel auto-fill",
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
          logger.error("Content script error:", error);
          sendResponse({ success: false, error: error.message });
        });
      return true;
    }
  );
}

async function handleMessage(
  message: ExtensionMessage
): Promise<ExtensionResponse> {
  switch (message.type) {
    case "GET_FORM_FIELDS":
      return handleGetFormFields();

    case "FILL_FORM":
      return handleFillForm(
        message.payload as { fields: DetectedField[]; values: AIFillResult }
      );

    case "TRIGGER_AUTOFILL":
      await triggerAutoFill();
      return { success: true };

    case "CHANGE_LANGUAGE":
      return handleChangeLanguage(message.payload as { language: "kr" | "en" });

    case "DEBUG_STREAM":
      return handleDebugStream(
        message.payload as { chunk: string; fullText: string }
      );

    default:
      return { success: false, error: `Unknown message type: ${message.type}` };
  }
}

function handleGetFormFields(): ExtensionResponse<DetectedField[]> {
  try {
    const fields = analyzeFormFields();
    return { success: true, data: fields };
  } catch (error) {
    logger.error("Form analysis failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Analysis failed",
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

    logger.log("Filling form with values:", values);

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
      showMenuToast(`Filled ${successCount} fields successfully!`, "success");
    } else {
      showMenuToast(`Filled ${successCount}, failed ${failCount}`, "error");
    }

    return {
      success: true,
      data: { totalFields: results.length, successCount, failCount, results },
    };
  } catch (error) {
    logger.error("Form fill failed:", error);
    showMenuToast("Form fill failed", "error");
    return {
      success: false,
      error: error instanceof Error ? error.message : "Fill failed",
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
    setMenuLoading(true, "Detecting fields...");
    showCancelButton(handleCancelRequest);

    // Get settings for enabled field types, vision recheck option, and max fill rounds
    const settings = await getSettings();
    const enabledFieldTypes = settings.enabledFieldTypes;
    const enableVisionRecheck = settings.enableVisionRecheck ?? false;
    const maxFillRounds = settings.maxFillRounds ?? 3; // Default 3 if not set

    let fields = analyzeFormFields();

    if (fields.length === 0) {
      showMenuToast("No form fields found", "error");
      setMenuLoading(false);
      hideCancelButton();
      return;
    }

    let totalFilledCount = 0;
    let lastFailedCount = 0;

    for (let round = 1; round <= maxFillRounds; round++) {
      const isRecheckRound = round > 1;
      const useVision = isRecheckRound && enableVisionRecheck;

      setMenuLoading(
        true,
        round === 1
          ? `Found ${fields.length} fields, analyzing...`
          : useVision
          ? `Round ${round}: Vision recheck (${fields.length} fields)...`
          : `Round ${round}: Re-analyzing ${fields.length} unfilled fields...`
      );

      // For vision recheck, take a full-page screenshot
      let screenshot: string | undefined;
      if (useVision) {
        setMenuLoading(
          true,
          `Round ${round}: Taking screenshot for vision analysis...`
        );

        try {
          const screenshotResponse = await chrome.runtime.sendMessage({
            type: "TAKE_SCREENSHOT",
          });
          if (screenshotResponse.success && screenshotResponse.data) {
            screenshot = screenshotResponse.data;
            logger.log("Vision recheck: Screenshot captured");
          }
        } catch (err) {
          logger.warn("Failed to take screenshot for vision recheck:", err);
        }
      }

      // Request AI to analyze form (with optional screenshot for vision recheck)
      const response = await chrome.runtime.sendMessage({
        type: "ANALYZE_FORM",
        payload: {
          url: window.location.href,
          fields,
          screenshot, // Include screenshot for vision-based analysis
          timestamp: Date.now(),
          isVisionRecheck: useVision, // Flag for AI to focus on unfilled fields
        },
      });

      if (!response.success) {
        throw new Error(response.error || "AI analysis failed");
      }

      setMenuLoading(
        true,
        round === 1
          ? "Filling form..."
          : `Round ${round}: Filling remaining fields...`
      );

      const fillResult = await handleFillForm({
        fields,
        values: response.data,
        enabledFieldTypes,
      });

      if (!fillResult.success) {
        throw new Error(fillResult.error || "Fill failed");
      }

      const resultData = fillResult.data as {
        totalFields: number;
        successCount: number;
        failCount: number;
        results: Array<{
          fieldId: string;
          success: boolean;
          skipped?: boolean;
          error?: string;
        }>;
      };

      totalFilledCount += resultData.successCount;

      // Get failed and not-skipped fields for retry
      const failedFieldIds = resultData.results
        .filter((r) => !r.success && !r.skipped)
        .map((r) => r.fieldId);

      logger.log(
        `Round ${round}: ${resultData.successCount} filled, ${failedFieldIds.length} failed`
      );

      // If no failures or all were skipped, we're done
      if (failedFieldIds.length === 0) {
        showMenuToast(
          `Filled ${totalFilledCount} fields successfully!`,
          "success"
        );
        break;
      }

      // If same number of failures as last round, stop to avoid infinite loop
      if (failedFieldIds.length === lastFailedCount) {
        logger.warn(
          `Same number of failures (${failedFieldIds.length}), stopping retry loop`
        );
        showMenuToast(
          `Filled ${totalFilledCount} fields, ${failedFieldIds.length} could not be filled`,
          failedFieldIds.length > 0 ? "error" : "success"
        );
        break;
      }

      lastFailedCount = failedFieldIds.length;

      // If we've reached max rounds, stop
      if (round >= maxFillRounds) {
        showMenuToast(
          `Filled ${totalFilledCount} fields after ${round} rounds, ${failedFieldIds.length} remaining`,
          "error"
        );
        break;
      }

      // Re-analyze only the unfilled fields for next round
      setMenuLoading(
        true,
        `Rechecking ${failedFieldIds.length} unfilled fields...`
      );

      // Wait for any async updates (API-loaded selects, dynamic fields)
      await sleep(500);

      // Re-detect fields from DOM (they may have changed)
      const freshFields = analyzeFormFields();

      // Filter to only unfilled fields
      fields = freshFields.filter((f) => {
        // Check if field was in failed list
        if (failedFieldIds.includes(f.id)) return true;

        // Also check if field has no current value (may be newly rendered)
        if (
          !f.currentValue ||
          f.currentValue === "" ||
          f.currentValue === "(empty)"
        ) {
          // Only include if it's an enabled field type and not skippable
          if (
            f.fillMethod !== "skip" &&
            f.fillMethod !== "computed" &&
            f.fillMethod !== "file"
          ) {
            if (!enabledFieldTypes || enabledFieldTypes.includes(f.type)) {
              return true;
            }
          }
        }

        return false;
      });

      if (fields.length === 0) {
        showMenuToast(
          `Filled ${totalFilledCount} fields successfully!`,
          "success"
        );
        break;
      }

      logger.log(`Retrying with ${fields.length} unfilled fields`);
    }
  } catch (error) {
    logger.error("Auto-fill failed:", error);
    showMenuToast(
      error instanceof Error ? error.message : "Auto-fill failed",
      "error"
    );
  } finally {
    setMenuLoading(false);
    hideCancelButton();
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
function handleChangeLanguage(payload: {
  language: "kr" | "en";
}): ExtensionResponse {
  try {
    const { language } = payload;

    // Set language in localStorage for persistence
    localStorage.setItem("language", language);

    // Call i18next directly via window object (some apps expose it)
    // Inject script to access React app's i18n instance
    const script = document.createElement("script");
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
          window.dispatchEvent(new CustomEvent('language-change', { detail: { language: '${language}' } }));
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
    showMenuToast(
      `Language: ${language === "kr" ? "한국어" : "English"}`,
      "success"
    );

    return { success: true };
  } catch (error) {
    logger.error("Failed to change language:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to change language",
    };
  }
}

/**
 * Handle debug stream message - update debug panel with AI output
 */
function handleDebugStream(payload: {
  chunk: string;
  fullText: string;
}): ExtensionResponse {
  try {
    updateMenuDebugStream(payload.chunk, payload.fullText);
    return { success: true };
  } catch (error) {
    logger.error("Debug stream update failed:", error);
    return { success: false, error: "Debug stream failed" };
  }
}

/**
 * Handle cancel request - cancel running AI analysis
 */
function handleCancelRequest(): void {
  logger.log("Cancel request triggered");

  // Send cancel message to background script
  chrome.runtime
    .sendMessage({ type: "CANCEL_REQUEST" })
    .then((response) => {
      if (response?.success && response?.data?.cancelled) {
        showMenuToast("Request cancelled", "error");
        setMenuLoading(false);
        hideCancelButton();
      }
    })
    .catch((err) => {
      logger.warn("Cancel request failed:", err);
    });
}

/**
 * Toggle language between KR and EN
 */
function toggleLanguage(): void {
  try {
    const currentLang = localStorage.getItem("language") || "kr";
    const newLang = currentLang === "kr" ? "en" : "kr";

    localStorage.setItem("language", newLang);

    const script = document.createElement("script");
    script.textContent = `
      if (window.i18next) {
        window.i18next.changeLanguage('${newLang}');
      }
    `;
    document.documentElement.appendChild(script);
    script.remove();

    logger.log(`Language switched to: ${newLang}`);
    showMenuToast(
      `${newLang === "kr" ? "🇰🇷 한국어" : "🇺🇸 English"}`,
      "success"
    );
  } catch (error) {
    logger.error("Language switch error:", error);
  }
}

/**
 * Open extension settings modal
 */
function openSettings(): void {
  openSettingsModal();
}

/**
 * Auto-fill icon SVG
 */
function getAutoFillIcon(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M15 4V2"/>
    <path d="M15 16v-2"/>
    <path d="M8 9h2"/>
    <path d="M20 9h2"/>
    <path d="M17.8 11.8 19 13"/>
    <path d="M15 9h.01"/>
    <path d="M17.8 6.2 19 5"/>
    <path d="m3 21 9-9"/>
    <path d="M12.2 6.2 11 5"/>
  </svg>`;
}

/**
 * Language icon SVG
 */
function getLangIcon(): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>`;
}

/**
 * Settings icon SVG
 */
function getSettingsIcon(): string {
  return `<svg width="800px" height="800px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M9 22H15C20 22 22 20 22 15V9C22 4 20 2 15 2H9C4 2 2 4 2 9V15C2 20 4 22 9 22Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M15.5699 18.5001V14.6001" stroke="currentColor" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M15.5699 7.45V5.5" stroke="currentColor" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M15.57 12.65C17.0059 12.65 18.17 11.4859 18.17 10.05C18.17 8.61401 17.0059 7.44995 15.57 7.44995C14.134 7.44995 12.97 8.61401 12.97 10.05C12.97 11.4859 14.134 12.65 15.57 12.65Z" stroke="currentColor" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M8.43005 18.5V16.55" stroke="currentColor" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M8.43005 9.4V5.5" stroke="currentColor" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M8.42996 16.5501C9.8659 16.5501 11.03 15.386 11.03 13.9501C11.03 12.5142 9.8659 11.3501 8.42996 11.3501C6.99402 11.3501 5.82996 12.5142 5.82996 13.9501C5.82996 15.386 6.99402 16.5501 8.42996 16.5501Z" stroke="currentColor" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
}
