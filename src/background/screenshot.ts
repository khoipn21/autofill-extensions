import { logger } from '@/utils/logger';

/**
 * Capture screenshot of the active tab's visible area
 * @returns Base64 encoded PNG image data URL
 */
export async function captureTabScreenshot(): Promise<string> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
      throw new Error('No active tab found');
    }

    const dataUrl: string = await new Promise((resolve, reject) => {
      chrome.tabs.captureVisibleTab({ format: 'png', quality: 90 }, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(result);
        }
      });
    });

    logger.log('Screenshot captured successfully');
    return dataUrl;
  } catch (error) {
    logger.error('Screenshot capture failed:', error);
    throw error;
  }
}

/**
 * Convert data URL to base64 string (without prefix)
 */
export function dataUrlToBase64(dataUrl: string): string {
  const prefix = 'data:image/png;base64,';
  if (dataUrl.startsWith(prefix)) {
    return dataUrl.slice(prefix.length);
  }
  return dataUrl;
}
