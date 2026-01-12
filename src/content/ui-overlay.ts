import { logger } from '@/utils/logger';

const OVERLAY_ID = 'ai-autofill-overlay';
const BUTTON_ID = 'ai-autofill-fab';
const LANG_BUTTON_ID = 'ai-lang-switcher';
const DEBUG_PANEL_ID = 'ai-debug-panel';
const CANCEL_BUTTON_ID = 'ai-cancel-btn';

interface OverlayState {
  isLoading: boolean;
  message: string;
}

// Callback for FAB click - set by initOverlay
let onFabClickHandler: (() => Promise<void>) | null = null;
// Callback for cancel - set by initOverlay
let onCancelHandler: (() => void) | null = null;

/**
 * Initialize the floating UI overlay on the page
 * @param onFabClick - callback to execute when FAB is clicked
 * @param onCancel - callback to execute when cancel is clicked
 */
export function initOverlay(onFabClick?: () => Promise<void>, onCancel?: () => void): void {
  if (document.getElementById(OVERLAY_ID)) {
    logger.log('Overlay already exists');
    return;
  }

  // Store the callbacks
  if (onFabClick) {
    onFabClickHandler = onFabClick;
  }
  if (onCancel) {
    onCancelHandler = onCancel;
  }

  const container = createOverlayContainer();
  document.body.appendChild(container);

  logger.log('Overlay initialized');
}

/**
 * Show/hide loading state
 */
export function setOverlayState(state: OverlayState): void {
  const button = document.getElementById(BUTTON_ID);
  if (!button) return;

  if (state.isLoading) {
    button.classList.add('loading');
    button.setAttribute('data-tooltip', state.message);
    showCancelButton();
  } else {
    button.classList.remove('loading');
    button.setAttribute('data-tooltip', 'Auto-Fill Form (Alt+F)');
    hideCancelButton();
  }
}

/**
 * Show cancel button
 */
function showCancelButton(): void {
  if (document.getElementById(CANCEL_BUTTON_ID)) return;

  const container = document.getElementById(OVERLAY_ID);
  if (!container) return;

  const cancelBtn = document.createElement('button');
  cancelBtn.id = CANCEL_BUTTON_ID;
  cancelBtn.className = 'ai-cancel-btn';
  cancelBtn.innerHTML = '✕ Cancel';
  cancelBtn.addEventListener('click', handleCancelClick);
  container.appendChild(cancelBtn);
}

/**
 * Hide cancel button
 */
function hideCancelButton(): void {
  const cancelBtn = document.getElementById(CANCEL_BUTTON_ID);
  if (cancelBtn) {
    cancelBtn.remove();
  }
}

/**
 * Handle cancel button click
 */
function handleCancelClick(): void {
  if (onCancelHandler) {
    onCancelHandler();
  }
  hideCancelButton();
}

/**
 * Remove overlay from page
 */
export function removeOverlay(): void {
  const container = document.getElementById(OVERLAY_ID);
  if (container) {
    container.remove();
    logger.log('Overlay removed');
  }
}

/**
 * Create the floating action button container
 */
function createOverlayContainer(): HTMLDivElement {
  const container = document.createElement('div');
  container.id = OVERLAY_ID;

  const styles = document.createElement('style');
  styles.textContent = getOverlayStyles();
  container.appendChild(styles);

  // Auto-fill FAB button
  const button = document.createElement('button');
  button.id = BUTTON_ID;
  button.className = 'ai-fab';
  button.setAttribute('data-tooltip', 'Auto-Fill Form (Alt+F)');
  button.innerHTML = getFabIcon();
  button.addEventListener('click', handleFabClick);
  container.appendChild(button);

  // Language switcher button
  const langButton = document.createElement('button');
  langButton.id = LANG_BUTTON_ID;
  langButton.className = 'ai-lang-btn';
  langButton.innerHTML = getLangIcon();
  langButton.addEventListener('click', handleLangClick);
  container.appendChild(langButton);

  return container;
}

/**
 * Handle FAB click - trigger auto-fill via callback
 */
async function handleFabClick(): Promise<void> {
  if (!onFabClickHandler) {
    logger.error('FAB click handler not set');
    return;
  }

  try {
    await onFabClickHandler();
  } catch (error) {
    logger.error('FAB click error:', error);
  }
}

/**
 * Handle language button click - toggle between KR and EN
 */
function handleLangClick(): void {
  try {
    // Get current language from localStorage
    const currentLang = localStorage.getItem('language') || 'kr';
    const newLang = currentLang === 'kr' ? 'en' : 'kr';

    // Set in localStorage
    localStorage.setItem('language', newLang);

    // Call i18next directly via injected script
    const script = document.createElement('script');
    script.textContent = `
      if (window.i18next) {
        window.i18next.changeLanguage('${newLang}');
      }
    `;
    document.documentElement.appendChild(script);
    script.remove();

    // Update button display
    updateLangButtonDisplay(newLang);

    logger.log(`Language switched to: ${newLang}`);
    showToast(`${newLang === 'kr' ? '🇰🇷 한국어' : '🇺🇸 English'}`, 'success');
  } catch (error) {
    logger.error('Language switch error:', error);
  }
}

/**
 * Update language button display
 */
function updateLangButtonDisplay(lang: string): void {
  const button = document.getElementById(LANG_BUTTON_ID);
  if (button) {
    button.innerHTML = getLangIcon(lang);
  }
}

/**
 * Language icon - shows current language
 */
function getLangIcon(lang?: string): string {
  const currentLang = lang || localStorage.getItem('language') || 'kr';
  const flag = currentLang === 'kr' ? '🇰🇷' : '🇺🇸';
  return `<span class="lang-flag">${flag}</span>`;
}

/**
 * Show debug panel for streaming AI output
 */
export function showDebugPanel(): void {
  if (document.getElementById(DEBUG_PANEL_ID)) return;

  const container = document.getElementById(OVERLAY_ID);
  if (!container) return;

  const panel = document.createElement('div');
  panel.id = DEBUG_PANEL_ID;
  panel.className = 'ai-debug-panel';
  panel.innerHTML = `
    <div class="debug-header">
      <span>🔍 AI Stream Debug</span>
      <button class="debug-close" onclick="this.closest('.ai-debug-panel').remove()">×</button>
    </div>
    <div class="debug-content"></div>
  `;
  container.appendChild(panel);
}

/**
 * Update debug panel with streaming content
 */
export function updateDebugStream(_chunk: string, fullText: string): void {
  const panel = document.getElementById(DEBUG_PANEL_ID);
  if (!panel) {
    showDebugPanel();
  }

  const content = document.querySelector(`#${DEBUG_PANEL_ID} .debug-content`);
  if (content) {
    content.textContent = fullText;
    content.scrollTop = content.scrollHeight;
  }
}

/**
 * Hide debug panel
 */
export function hideDebugPanel(): void {
  const panel = document.getElementById(DEBUG_PANEL_ID);
  if (panel) {
    panel.remove();
  }
}

/**
 * FAB icon SVG (magic wand)
 */
function getFabIcon(): string {
  return `
    <svg class="fab-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M15 4V2"/>
      <path d="M15 16v-2"/>
      <path d="M8 9h2"/>
      <path d="M20 9h2"/>
      <path d="M17.8 11.8 19 13"/>
      <path d="M15 9h.01"/>
      <path d="M17.8 6.2 19 5"/>
      <path d="m3 21 9-9"/>
      <path d="M12.2 6.2 11 5"/>
    </svg>
    <svg class="fab-spinner" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  `;
}

/**
 * Overlay CSS styles
 */
function getOverlayStyles(): string {
  return `
    #${OVERLAY_ID} {
      position: fixed;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .ai-fab {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      border: none;
      background: linear-gradient(135deg, #228be6 0%, #1c7ed6 100%);
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(34, 139, 230, 0.4);
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .ai-fab:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 16px rgba(34, 139, 230, 0.5);
    }

    .ai-fab:active {
      transform: scale(0.95);
    }

    .ai-fab::before {
      content: attr(data-tooltip);
      position: absolute;
      right: calc(100% + 12px);
      top: 50%;
      transform: translateY(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 13px;
      white-space: nowrap;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.2s, visibility 0.2s;
    }

    .ai-fab:hover::before {
      opacity: 1;
      visibility: visible;
    }

    .fab-icon, .fab-spinner {
      width: 24px;
      height: 24px;
    }

    .fab-spinner {
      display: none;
      animation: spin 1s linear infinite;
    }

    .ai-fab.loading .fab-icon {
      display: none;
    }

    .ai-fab.loading .fab-spinner {
      display: block;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* Language switcher button */
    .ai-lang-btn {
      position: fixed;
      bottom: 90px;
      right: 32px;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: 2px solid #e9ecef;
      background: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
    }

    .ai-lang-btn:hover {
      transform: scale(1.1);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      border-color: #228be6;
    }

    .ai-lang-btn:active {
      transform: scale(0.95);
    }

    .lang-flag {
      font-size: 20px;
      line-height: 1;
    }

    /* Cancel button */
    .ai-cancel-btn {
      position: fixed;
      bottom: 90px;
      right: 90px;
      padding: 8px 16px;
      border-radius: 20px;
      border: none;
      background: #fa5252;
      color: white;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      box-shadow: 0 2px 8px rgba(250, 82, 82, 0.4);
      transition: transform 0.2s, box-shadow 0.2s, background 0.2s;
      animation: fadeIn 0.2s ease;
    }

    .ai-cancel-btn:hover {
      background: #e03131;
      transform: scale(1.05);
      box-shadow: 0 4px 12px rgba(250, 82, 82, 0.5);
    }

    .ai-cancel-btn:active {
      transform: scale(0.95);
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.8); }
      to { opacity: 1; transform: scale(1); }
    }

    /* Toast notification */
    .ai-toast {
      position: fixed;
      bottom: 140px;
      right: 24px;
      background: white;
      border-radius: 8px;
      padding: 12px 16px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      animation: slideIn 0.3s ease;
      max-width: 280px;
    }

    .ai-toast.success {
      border-left: 4px solid #40c057;
    }

    .ai-toast.error {
      border-left: 4px solid #fa5252;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateX(20px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    /* Debug panel for streaming AI output */
    .ai-debug-panel {
      position: fixed;
      bottom: 100px;
      right: 100px;
      width: 400px;
      max-height: 300px;
      background: #1a1a2e;
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      overflow: hidden;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 12px;
      z-index: 999999;
    }

    .debug-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: #16213e;
      color: #00d9ff;
      font-weight: 600;
      border-bottom: 1px solid #0f3460;
    }

    .debug-close {
      background: none;
      border: none;
      color: #888;
      font-size: 18px;
      cursor: pointer;
      line-height: 1;
      padding: 0 4px;
    }

    .debug-close:hover {
      color: #fa5252;
    }

    .debug-content {
      padding: 12px;
      color: #e0e0e0;
      max-height: 240px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.5;
    }

    .debug-content::-webkit-scrollbar {
      width: 6px;
    }

    .debug-content::-webkit-scrollbar-track {
      background: #1a1a2e;
    }

    .debug-content::-webkit-scrollbar-thumb {
      background: #0f3460;
      border-radius: 3px;
    }
  `;
}

/**
 * Show toast notification
 */
export function showToast(message: string, type: 'success' | 'error' = 'success'): void {
  const existing = document.querySelector('.ai-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `ai-toast ${type}`;

  const icon =
    type === 'success'
      ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#40c057" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
      : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fa5252" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';

  toast.innerHTML = `${icon}<span>${message}</span>`;

  const container = document.getElementById(OVERLAY_ID) || document.body;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
