import type {
  ExtensionMessage,
  ExtensionResponse,
  ExtensionSettings,
  FormAnalysis,
  AIFillResult,
} from '@/shared/types';
import { getSettings, saveSettings } from './storage';
import { captureTabScreenshot } from './screenshot';
import { analyzeFormWithAI, testApiConnection, cancelAIRequest, type StreamCallback } from './ai-service';
import { logger } from '@/utils/logger';

logger.log('Background service worker loaded');

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: ExtensionResponse) => void
  ) => {
    handleMessage(message, sender)
      .then(sendResponse)
      .catch((error) => {
        logger.error('Message handling error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
);

async function handleMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender
): Promise<ExtensionResponse> {
  switch (message.type) {
    case 'GET_SETTINGS':
      return { success: true, data: await getSettings() };

    case 'SET_SETTINGS':
      await saveSettings(message.payload as Partial<ExtensionSettings>);
      return { success: true };

    case 'TAKE_SCREENSHOT':
      return handleTakeScreenshot();

    case 'ANALYZE_FORM':
      return handleAnalyzeForm(message.payload as FormAnalysis, sender);

    case 'TEST_CONNECTION':
      return { success: true, data: await testApiConnection() };

    case 'CANCEL_REQUEST':
      return { success: true, data: { cancelled: cancelAIRequest() } };

    default:
      return { success: false, error: `Unknown message type: ${message.type}` };
  }
}

async function handleTakeScreenshot(): Promise<ExtensionResponse<string>> {
  try {
    const screenshot = await captureTabScreenshot();
    return { success: true, data: screenshot };
  } catch (error) {
    logger.error('Screenshot failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Screenshot failed',
    };
  }
}

async function handleAnalyzeForm(
  formAnalysis: FormAnalysis,
  sender: chrome.runtime.MessageSender
): Promise<ExtensionResponse<AIFillResult>> {
  try {
    if (!formAnalysis.screenshot) {
      formAnalysis.screenshot = await captureTabScreenshot();
    }

    const settings = await getSettings();
    const tabId = sender.tab?.id;

    // Create stream callback if debug mode enabled
    let onStream: StreamCallback | undefined;
    if (settings.debugMode && tabId) {
      onStream = (chunk: string, fullText: string) => {
        // Send streaming chunk to content script for debug display
        chrome.tabs.sendMessage(tabId, {
          type: 'DEBUG_STREAM',
          payload: { chunk, fullText },
        }).catch(() => {
          // Ignore errors if content script isn't ready
        });
      };
    }

    const result = await analyzeFormWithAI(formAnalysis, 3, onStream);
    return { success: true, data: result };
  } catch (error) {
    logger.error('Form analysis failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Analysis failed',
    };
  }
}

// Extension install/update handler
chrome.runtime.onInstalled.addListener(async (details) => {
  logger.log('Extension installed:', details.reason);
});
