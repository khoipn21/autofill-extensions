/**
 * Settings Modal Component
 * Glassmorphism-styled modal for extension settings
 * Injected into content script for in-page configuration
 */

import { getSettings, saveSettings } from '@/shared/storage';
import {
  AVAILABLE_MODELS,
  DEFAULT_ENABLED_FIELD_TYPES,
  DEFAULT_PROVIDER_PROFILES,
  PROVIDER_INFO,
} from '@/shared/constants';
import type {
  AIProvider,
  ExtensionSettings,
  FieldType,
  ProviderProfile,
} from '@/shared/types';
import { logger } from '@/utils/logger';

// Element IDs
const MODAL_CONTAINER_ID = 'ai-settings-modal';
const MODAL_BACKDROP_ID = 'ai-settings-backdrop';

// State
let isOpen = false;
let currentSettings: ExtensionSettings | null = null;
let activeProvider: AIProvider = 'openrouter';

/**
 * Open settings modal
 */
export async function openSettingsModal(): Promise<void> {
  if (isOpen) return;

  try {
    currentSettings = await getSettings();
    activeProvider = currentSettings.activeProvider || 'openrouter';
    createModal();
    isOpen = true;
    logger.log('Settings modal opened');
  } catch (error) {
    logger.error('Failed to open settings modal:', error);
  }
}

/**
 * Close settings modal
 */
export function closeSettingsModal(): void {
  const container = document.getElementById(MODAL_CONTAINER_ID);
  const backdrop = document.getElementById(MODAL_BACKDROP_ID);

  if (container) {
    container.classList.add('closing');
    setTimeout(() => container.remove(), 300);
  }
  if (backdrop) {
    backdrop.classList.add('closing');
    setTimeout(() => backdrop.remove(), 300);
  }

  isOpen = false;
  currentSettings = null;
  logger.log('Settings modal closed');
}

/**
 * Check if modal is open
 */
export function isSettingsModalOpen(): boolean {
  return isOpen;
}

/**
 * Create the modal DOM structure
 */
function createModal(): void {
  // Remove existing modal if any
  document.getElementById(MODAL_CONTAINER_ID)?.remove();
  document.getElementById(MODAL_BACKDROP_ID)?.remove();

  // Create backdrop
  const backdrop = document.createElement('div');
  backdrop.id = MODAL_BACKDROP_ID;
  backdrop.addEventListener('click', closeSettingsModal);

  // Create container
  const container = document.createElement('div');
  container.id = MODAL_CONTAINER_ID;

  // Add styles
  const styles = document.createElement('style');
  styles.textContent = getModalStyles();
  container.appendChild(styles);

  // Create modal content
  const modal = document.createElement('div');
  modal.className = 'settings-modal';
  modal.innerHTML = getModalContent();
  container.appendChild(modal);

  // Append to body
  document.body.appendChild(backdrop);
  document.body.appendChild(container);

  // Trigger animations
  requestAnimationFrame(() => {
    backdrop.classList.add('visible');
    container.classList.add('visible');
  });

  // Add event listeners
  setupEventListeners(modal);
}

/**
 * Get modal content HTML
 */
function getModalContent(): string {
  if (!currentSettings) return '';

  const profile = currentSettings.providers?.[activeProvider] || DEFAULT_PROVIDER_PROFILES[activeProvider];
  const models = AVAILABLE_MODELS.filter(m => m.provider === activeProvider);

  return `
    <div class="modal-header">
      <h2 class="modal-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 22H15C20 22 22 20 22 15V9C22 4 20 2 15 2H9C4 2 2 4 2 9V15C2 20 4 22 9 22Z"/>
          <path d="M15.57 18.5V14.6" stroke-miterlimit="10" stroke-linecap="round"/>
          <path d="M15.57 7.45V5.5" stroke-miterlimit="10" stroke-linecap="round"/>
          <circle cx="15.57" cy="10.05" r="2.6"/>
          <path d="M8.43 18.5V16.55" stroke-miterlimit="10" stroke-linecap="round"/>
          <path d="M8.43 9.4V5.5" stroke-miterlimit="10" stroke-linecap="round"/>
          <circle cx="8.43" cy="13.95" r="2.6"/>
        </svg>
        Settings
      </h2>
      <button class="close-btn" data-action="close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>

    <div class="modal-body">
      <!-- Extension Toggle -->
      <div class="setting-group">
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-icon power">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2v10M18.4 6.6a9 9 0 1 1-12.77.04"/>
              </svg>
            </span>
            <div class="setting-text">
              <span class="setting-label">Extension Enabled</span>
              <span class="setting-desc">Toggle extension on/off globally</span>
            </div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="setting-enabled" ${currentSettings.enabled ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>

      <!-- Provider Selection -->
      <div class="setting-group">
        <div class="setting-label-header">AI Provider</div>
        <div class="provider-grid">
          ${(['openrouter', 'gemini'] as AIProvider[]).map(provider => `
            <button
              class="provider-card ${activeProvider === provider ? 'active' : ''}"
              data-action="select-provider"
              data-provider="${provider}"
            >
              <div class="provider-icon ${provider}">
                ${provider === 'openrouter'
                  ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6M9 12h6M9 15h4"/></svg>'
                  : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/><path d="M5 19l1 3 1-3M12 17l1 3 1-3M19 19l1 3 1-3"/></svg>'
                }
              </div>
              <div class="provider-info">
                <span class="provider-name">${PROVIDER_INFO[provider].name}</span>
                <span class="provider-desc">${PROVIDER_INFO[provider].description}</span>
              </div>
              ${activeProvider === provider ? '<div class="active-indicator"></div>' : ''}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- API Key -->
      <div class="setting-group">
        <div class="setting-label-header">API Key</div>
        <div class="input-group">
          <input
            type="password"
            id="setting-apikey"
            class="text-input"
            placeholder="${PROVIDER_INFO[activeProvider].keyPrefix}..."
            value="${profile.apiKey || ''}"
          >
          <button class="icon-btn" data-action="toggle-password" title="Show/Hide">
            <svg class="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Model Selection -->
      <div class="setting-group">
        <div class="setting-label-header">Model</div>
        <select id="setting-model" class="select-input">
          ${models.map(m => `
            <option value="${m.id}" ${profile.model === m.id ? 'selected' : ''}>
              ${m.name} ${m.recommended ? '⭐' : ''} ${m.supportsVision ? '👁️' : ''}
            </option>
          `).join('')}
        </select>
      </div>

      <!-- Max Fill Rounds -->
      <div class="setting-group">
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-icon retry">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 4v6h6M23 20v-6h-6"/>
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
              </svg>
            </span>
            <div class="setting-text">
              <span class="setting-label">Max Fill Rounds</span>
              <span class="setting-desc">Retry rounds for unfilled fields (1-10)</span>
            </div>
          </div>
          <input
            type="number"
            id="setting-maxrounds"
            class="number-input"
            min="1"
            max="10"
            value="${currentSettings.maxFillRounds ?? 3}"
          >
        </div>
      </div>

      <!-- Vision Recheck -->
      <div class="setting-group">
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-icon vision">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </span>
            <div class="setting-text">
              <span class="setting-label">Vision Recheck</span>
              <span class="setting-desc">Use screenshot for verification (uses more tokens)</span>
            </div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="setting-vision" ${currentSettings.enableVisionRecheck ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>

      <!-- Debug Mode -->
      <div class="setting-group">
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-icon debug">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                <path d="M12 17h.01"/>
              </svg>
            </span>
            <div class="setting-text">
              <span class="setting-label">Debug Mode</span>
              <span class="setting-desc">Show streaming AI output in real-time</span>
            </div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="setting-debug" ${currentSettings.debugMode ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>

      <!-- Field Types -->
      <div class="setting-group">
        <div class="setting-label-header">Enabled Field Types</div>
        <div class="field-types-grid">
          ${(['text', 'number', 'date', 'select', 'checkbox', 'radio', 'textarea', 'richtext', 'dynamic'] as FieldType[]).map(type => `
            <label class="field-type-chip ${(currentSettings?.enabledFieldTypes || DEFAULT_ENABLED_FIELD_TYPES).includes(type) ? 'active' : ''}">
              <input type="checkbox" value="${type}" ${(currentSettings?.enabledFieldTypes || DEFAULT_ENABLED_FIELD_TYPES).includes(type) ? 'checked' : ''}>
              ${type}
            </label>
          `).join('')}
        </div>
      </div>
    </div>

    <div class="modal-footer">
      <button class="btn btn-secondary" data-action="close">Cancel</button>
      <button class="btn btn-primary" data-action="save">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
          <polyline points="17,21 17,13 7,13 7,21"/>
          <polyline points="7,3 7,8 15,8"/>
        </svg>
        Save Settings
      </button>
    </div>
  `;
}

/**
 * Setup event listeners for modal interactions
 */
function setupEventListeners(modal: HTMLElement): void {
  // Close button and cancel
  modal.querySelectorAll('[data-action="close"]').forEach(btn => {
    btn.addEventListener('click', closeSettingsModal);
  });

  // Provider selection
  modal.querySelectorAll('[data-action="select-provider"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      const provider = target.dataset.provider as AIProvider;
      if (provider && provider !== activeProvider) {
        activeProvider = provider;
        refreshModalContent(modal);
      }
    });
  });

  // Toggle password visibility
  modal.querySelectorAll('[data-action="toggle-password"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = modal.querySelector('#setting-apikey') as HTMLInputElement;
      if (input) {
        input.type = input.type === 'password' ? 'text' : 'password';
      }
    });
  });

  // Field type checkboxes
  modal.querySelectorAll('.field-type-chip input').forEach(input => {
    input.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      const label = target.closest('.field-type-chip');
      if (label) {
        label.classList.toggle('active', target.checked);
      }
    });
  });

  // Save button
  modal.querySelector('[data-action="save"]')?.addEventListener('click', handleSave);

  // Escape key to close
  document.addEventListener('keydown', handleKeyDown);
}

/**
 * Handle keyboard events
 */
function handleKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && isOpen) {
    closeSettingsModal();
    document.removeEventListener('keydown', handleKeyDown);
  }
}

/**
 * Refresh modal content (when provider changes)
 */
function refreshModalContent(modal: HTMLElement): void {
  modal.innerHTML = getModalContent();
  setupEventListeners(modal);
}

/**
 * Handle save settings
 */
async function handleSave(): Promise<void> {
  if (!currentSettings) return;

  const modal = document.querySelector('.settings-modal');
  if (!modal) return;

  // Gather values
  const enabled = (modal.querySelector('#setting-enabled') as HTMLInputElement)?.checked ?? true;
  const apiKey = (modal.querySelector('#setting-apikey') as HTMLInputElement)?.value || '';
  const model = (modal.querySelector('#setting-model') as HTMLSelectElement)?.value || '';
  const maxFillRounds = parseInt((modal.querySelector('#setting-maxrounds') as HTMLInputElement)?.value || '3', 10);
  const enableVisionRecheck = (modal.querySelector('#setting-vision') as HTMLInputElement)?.checked ?? false;
  const debugMode = (modal.querySelector('#setting-debug') as HTMLInputElement)?.checked ?? false;

  // Gather enabled field types
  const enabledFieldTypes: FieldType[] = [];
  modal.querySelectorAll('.field-type-chip input:checked').forEach(input => {
    enabledFieldTypes.push((input as HTMLInputElement).value as FieldType);
  });

  // Build updated provider profile
  const updatedProfile: ProviderProfile = {
    ...currentSettings.providers[activeProvider],
    apiKey,
    model,
  };

  // Build updated settings
  const updatedSettings: Partial<ExtensionSettings> = {
    enabled,
    activeProvider,
    providers: {
      ...currentSettings.providers,
      [activeProvider]: updatedProfile,
    },
    enabledFieldTypes,
    maxFillRounds,
    enableVisionRecheck,
    debugMode,
  };

  try {
    // Show saving state
    const saveBtn = modal.querySelector('[data-action="save"]') as HTMLButtonElement;
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = `
        <svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        Saving...
      `;
    }

    await saveSettings(updatedSettings);
    logger.log('Settings saved successfully');

    // Show success and close
    setTimeout(() => {
      closeSettingsModal();
    }, 300);
  } catch (error) {
    logger.error('Failed to save settings:', error);
  }
}

/**
 * Get modal styles
 */
function getModalStyles(): string {
  return `
    /* Backdrop */
    #${MODAL_BACKDROP_ID} {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0);
      backdrop-filter: blur(0px);
      z-index: 999998;
      transition: all 0.3s ease-out;
    }

    #${MODAL_BACKDROP_ID}.visible {
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
    }

    #${MODAL_BACKDROP_ID}.closing {
      background: rgba(0, 0, 0, 0);
      backdrop-filter: blur(0px);
    }

    /* Modal Container */
    #${MODAL_CONTAINER_ID} {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      opacity: 0;
      transition: opacity 0.3s ease-out;
      pointer-events: none;
    }

    #${MODAL_CONTAINER_ID}.visible {
      opacity: 1;
      pointer-events: auto;
    }

    #${MODAL_CONTAINER_ID}.closing {
      opacity: 0;
    }

    /* Modal Panel */
    .settings-modal {
      width: 90%;
      max-width: 480px;
      max-height: 85vh;
      background: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      box-shadow:
        0 25px 50px -12px rgba(0, 0, 0, 0.5),
        0 0 0 1px rgba(255, 255, 255, 0.05) inset;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transform: scale(0.95) translateY(10px);
      transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    #${MODAL_CONTAINER_ID}.visible .settings-modal {
      transform: scale(1) translateY(0);
    }

    #${MODAL_CONTAINER_ID}.closing .settings-modal {
      transform: scale(0.95) translateY(10px);
    }

    /* Header */
    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 24px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .modal-title {
      display: flex;
      align-items: center;
      gap: 12px;
      color: #fff;
      font-size: 18px;
      font-weight: 600;
      margin: 0;
    }

    .modal-title svg {
      width: 24px;
      height: 24px;
      color: #3B82F6;
    }

    .close-btn {
      width: 36px;
      height: 36px;
      border: none;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 10px;
      color: #94a3b8;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }

    .close-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }

    .close-btn svg {
      width: 18px;
      height: 18px;
    }

    /* Body */
    .modal-body {
      flex: 1;
      overflow-y: auto;
      padding: 20px 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .modal-body::-webkit-scrollbar {
      width: 6px;
    }

    .modal-body::-webkit-scrollbar-track {
      background: transparent;
    }

    .modal-body::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.15);
      border-radius: 3px;
    }

    /* Setting Groups */
    .setting-group {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .setting-label-header {
      color: #94a3b8;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .setting-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 12px 16px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 12px;
    }

    .setting-info {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
      min-width: 0;
    }

    .setting-icon {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .setting-icon svg {
      width: 18px;
      height: 18px;
    }

    .setting-icon.power {
      background: rgba(34, 197, 94, 0.15);
      color: #22c55e;
    }

    .setting-icon.vision {
      background: rgba(168, 85, 247, 0.15);
      color: #a855f7;
    }

    .setting-icon.debug {
      background: rgba(249, 115, 22, 0.15);
      color: #f97316;
    }

    .setting-icon.retry {
      background: rgba(59, 130, 246, 0.15);
      color: #3b82f6;
    }

    .setting-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .setting-label {
      color: #f1f5f9;
      font-size: 14px;
      font-weight: 500;
    }

    .setting-desc {
      color: #64748b;
      font-size: 12px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Toggle Switch */
    .toggle-switch {
      position: relative;
      width: 44px;
      height: 24px;
      flex-shrink: 0;
      cursor: pointer;
    }

    .toggle-switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .toggle-slider {
      position: absolute;
      inset: 0;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 24px;
      transition: all 0.2s ease;
    }

    .toggle-slider::before {
      content: '';
      position: absolute;
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background: #fff;
      border-radius: 50%;
      transition: all 0.2s ease;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }

    .toggle-switch input:checked + .toggle-slider {
      background: #3B82F6;
    }

    .toggle-switch input:checked + .toggle-slider::before {
      transform: translateX(20px);
    }

    /* Provider Grid */
    .provider-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .provider-card {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 16px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      cursor: pointer;
      text-align: left;
      transition: all 0.2s ease;
    }

    .provider-card:hover {
      background: rgba(255, 255, 255, 0.06);
      border-color: rgba(255, 255, 255, 0.12);
    }

    .provider-card.active {
      background: rgba(59, 130, 246, 0.1);
      border-color: rgba(59, 130, 246, 0.4);
    }

    .provider-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .provider-icon svg {
      width: 22px;
      height: 22px;
    }

    .provider-icon.openrouter {
      background: rgba(59, 130, 246, 0.15);
      color: #3B82F6;
    }

    .provider-icon.gemini {
      background: rgba(168, 85, 247, 0.15);
      color: #a855f7;
    }

    .provider-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .provider-name {
      color: #f1f5f9;
      font-size: 14px;
      font-weight: 600;
    }

    .provider-desc {
      color: #64748b;
      font-size: 11px;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .active-indicator {
      position: absolute;
      top: 12px;
      right: 12px;
      width: 8px;
      height: 8px;
      background: #3B82F6;
      border-radius: 50%;
      box-shadow: 0 0 8px rgba(59, 130, 246, 0.6);
    }

    /* Inputs */
    .input-group {
      display: flex;
      gap: 8px;
    }

    .text-input,
    .select-input {
      flex: 1;
      padding: 12px 16px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      color: #f1f5f9;
      font-size: 14px;
      transition: all 0.2s ease;
    }

    .text-input:focus,
    .select-input:focus {
      outline: none;
      border-color: #3B82F6;
      background: rgba(59, 130, 246, 0.05);
    }

    .text-input::placeholder {
      color: #475569;
    }

    .select-input {
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 12px center;
      padding-right: 40px;
    }

    .select-input option {
      background: #1e293b;
      color: #f1f5f9;
    }

    .number-input {
      width: 60px;
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      color: #f1f5f9;
      font-size: 14px;
      text-align: center;
      transition: all 0.2s ease;
    }

    .number-input:focus {
      outline: none;
      border-color: #3B82F6;
    }

    .icon-btn {
      width: 44px;
      height: 44px;
      border: none;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 10px;
      color: #94a3b8;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      flex-shrink: 0;
    }

    .icon-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }

    .icon-btn svg {
      width: 18px;
      height: 18px;
    }

    /* Field Types Grid */
    .field-types-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .field-type-chip {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      color: #94a3b8;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s ease;
      user-select: none;
    }

    .field-type-chip input {
      display: none;
    }

    .field-type-chip:hover {
      background: rgba(255, 255, 255, 0.06);
    }

    .field-type-chip.active {
      background: rgba(59, 130, 246, 0.15);
      border-color: rgba(59, 130, 246, 0.3);
      color: #60a5fa;
    }

    /* Footer */
    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
    }

    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 20px;
      border: none;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn svg {
      width: 16px;
      height: 16px;
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.05);
      color: #94a3b8;
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #f1f5f9;
    }

    .btn-primary {
      background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
      color: #fff;
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
    }

    .btn-primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
    }

    .btn-primary:disabled {
      opacity: 0.7;
      cursor: not-allowed;
      transform: none;
    }

    /* Spin animation */
    .spin {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* Mobile responsive */
    @media (max-width: 520px) {
      .settings-modal {
        width: 95%;
        max-height: 90vh;
        border-radius: 16px;
      }

      .modal-header {
        padding: 16px 20px;
      }

      .modal-body {
        padding: 16px 20px;
      }

      .modal-footer {
        padding: 12px 20px;
      }

      .provider-grid {
        grid-template-columns: 1fr;
      }

      .setting-desc {
        display: none;
      }
    }
  `;
}
