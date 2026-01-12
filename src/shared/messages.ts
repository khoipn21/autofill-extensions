import type { ExtensionMessage, ExtensionResponse } from './types';

/**
 * Send message to background service worker
 */
export async function sendToBackground<T = unknown, R = unknown>(
  message: ExtensionMessage<T>
): Promise<ExtensionResponse<R>> {
  return chrome.runtime.sendMessage(message);
}

/**
 * Send message to content script in active tab
 */
export async function sendToContent<T = unknown, R = unknown>(
  message: ExtensionMessage<T>
): Promise<ExtensionResponse<R>> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    return { success: false, error: 'No active tab found' };
  }

  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send message',
    };
  }
}
