import { logger } from '@/utils/logger';

const MENU_CONTAINER_ID = 'ai-circular-menu';
const MENU_TOGGLE_ID = 'ai-menu-toggle';
const MENU_ITEMS_ID = 'ai-menu-items';

interface MenuItem {
  id: string;
  icon: string;
  label: string;
  onClick: () => void;
  color?: string;
}

interface MenuState {
  isOpen: boolean;
  isDragging: boolean;
  position: { x: number; y: number };
}

// Menu state - position will be set on init
const menuState: MenuState = {
  isOpen: false,
  isDragging: false,
  position: { x: 0, y: 0 }, // Will be set properly in initCircularMenu
};

// Menu items configuration
let menuItems: MenuItem[] = [];

// Drag state
let dragOffset = { x: 0, y: 0 };
let dragStartTime = 0;

/**
 * Initialize circular menu
 */
export function initCircularMenu(items: MenuItem[]): void {
  if (document.getElementById(MENU_CONTAINER_ID)) {
    return;
  }

  // Set initial position to bottom-right corner
  menuState.position = {
    x: window.innerWidth - 80,
    y: window.innerHeight - 80,
  };

  menuItems = items;
  const container = createMenuContainer();
  document.body.appendChild(container);

  // Add event listeners
  addDragListeners();
  addResizeListener();
}

/**
 * Toggle menu open/close state
 */
export function toggleMenu(): void {
  menuState.isOpen = !menuState.isOpen;
  updateMenuVisuals();
}

/**
 * Open the menu
 */
export function openMenu(): void {
  if (!menuState.isOpen) {
    menuState.isOpen = true;
    updateMenuVisuals();
  }
}

/**
 * Close the menu
 */
export function closeMenu(): void {
  if (menuState.isOpen) {
    menuState.isOpen = false;
    updateMenuVisuals();
  }
}

/**
 * Update menu item by id
 */
export function updateMenuItem(id: string, updates: Partial<MenuItem>): void {
  const index = menuItems.findIndex(item => item.id === id);
  if (index !== -1) {
    menuItems[index] = { ...menuItems[index], ...updates };
    renderMenuItems();
  }
}

/**
 * Set loading state for toggle button
 */
export function setMenuLoading(isLoading: boolean, message?: string): void {
  const toggle = document.getElementById(MENU_TOGGLE_ID);
  if (!toggle) return;

  if (isLoading) {
    toggle.classList.add('loading');
    toggle.setAttribute('data-tooltip', message || 'Processing...');
  } else {
    toggle.classList.remove('loading');
    toggle.setAttribute('data-tooltip', 'AI Tools');
  }
}

/**
 * Remove circular menu
 */
export function removeCircularMenu(): void {
  const container = document.getElementById(MENU_CONTAINER_ID);
  if (container) {
    container.remove();
    logger.log('Circular menu removed');
  }
}

/**
 * Create menu container with styles and elements
 */
function createMenuContainer(): HTMLDivElement {
  const container = document.createElement('div');
  container.id = MENU_CONTAINER_ID;

  // Add styles
  const styles = document.createElement('style');
  styles.textContent = getMenuStyles();
  container.appendChild(styles);

  // Create toggle button
  const toggle = createToggleButton();
  container.appendChild(toggle);

  // Create menu items container
  const itemsContainer = document.createElement('div');
  itemsContainer.id = MENU_ITEMS_ID;
  itemsContainer.className = 'menu-items';
  container.appendChild(itemsContainer);

  // Render menu items directly into the container (before it's in DOM)
  renderMenuItemsInto(itemsContainer);

  // Set initial position directly on the container
  updatePosition(container);

  return container;
}

/**
 * Create the main toggle button
 */
function createToggleButton(): HTMLButtonElement {
  const button = document.createElement('button');
  button.id = MENU_TOGGLE_ID;
  button.className = 'menu-toggle';
  button.setAttribute('data-tooltip', 'AI Tools');
  button.innerHTML = getToggleIcon();
  button.addEventListener('click', handleToggleClick);
  button.addEventListener('mousedown', handleDragStart);
  button.addEventListener('touchstart', handleTouchStart, { passive: false });

  return button;
}

/**
 * Render menu items in circular positions
 * @param targetContainer - optional container element, uses DOM lookup if not provided
 */
function renderMenuItemsInto(targetContainer?: HTMLElement): void {
  const itemsContainer = targetContainer || document.getElementById(MENU_ITEMS_ID);
  if (!itemsContainer) {
    return;
  }

  itemsContainer.innerHTML = '';

  const itemCount = menuItems.length;
  // Spread items in upper-left quadrant (180° to 270°)
  const angleStep = 90 / Math.max(itemCount - 1, 1);
  const startAngle = 225; // Start at 225° (upper-left diagonal)
  const radius = 75; // Distance from center

  menuItems.forEach((item, index) => {
    // Distribute evenly around the arc
    const angle = startAngle - (angleStep * index);
    const radian = (angle * Math.PI) / 180;
    const x = Math.cos(radian) * radius;
    const y = Math.sin(radian) * radius;

    const itemBtn = document.createElement('button');
    itemBtn.className = 'menu-item';
    itemBtn.setAttribute('data-tooltip', item.label);
    itemBtn.setAttribute('data-id', item.id);
    itemBtn.style.setProperty('--item-x', `${x}px`);
    itemBtn.style.setProperty('--item-y', `${y}px`);
    itemBtn.style.setProperty('--item-delay', `${index * 50}ms`);

    if (item.color) {
      itemBtn.style.setProperty('--item-color', item.color);
    }

    itemBtn.innerHTML = item.icon;
    itemBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      item.onClick();
      closeMenu();
    });

    itemsContainer.appendChild(itemBtn);
  });
}

/**
 * Render menu items (for re-rendering after DOM is ready)
 */
function renderMenuItems(): void {
  renderMenuItemsInto();
}

/**
 * Update visual state of menu
 */
function updateMenuVisuals(): void {
  const container = document.getElementById(MENU_CONTAINER_ID);
  const toggle = document.getElementById(MENU_TOGGLE_ID);

  if (!container || !toggle) return;

  if (menuState.isOpen) {
    container.classList.add('open');
    toggle.classList.add('open');
  } else {
    container.classList.remove('open');
    toggle.classList.remove('open');
  }
}

/**
 * Update menu position
 * @param targetContainer - optional container element, uses DOM lookup if not provided
 */
function updatePosition(targetContainer?: HTMLElement): void {
  const container = targetContainer || document.getElementById(MENU_CONTAINER_ID);
  if (!container) {
    return;
  }

  // Button is 56px, add 24px padding from edges
  const padding = 24;
  const buttonSize = 56;
  const maxX = window.innerWidth - buttonSize - padding;
  const maxY = window.innerHeight - buttonSize - padding;

  // Constrain position to viewport
  menuState.position.x = Math.max(padding, Math.min(menuState.position.x, maxX));
  menuState.position.y = Math.max(padding, Math.min(menuState.position.y, maxY));

  container.style.left = `${menuState.position.x}px`;
  container.style.top = `${menuState.position.y}px`;
}

/**
 * Handle toggle button click
 */
function handleToggleClick(): void {
  // Only toggle if not dragging (quick click vs drag)
  if (Date.now() - dragStartTime < 200 && !menuState.isDragging) {
    toggleMenu();
  }
}

/**
 * Handle drag start
 */
function handleDragStart(e: MouseEvent): void {
  if (e.button !== 0) return; // Only left click

  dragStartTime = Date.now();
  const container = document.getElementById(MENU_CONTAINER_ID);
  if (!container) return;

  dragOffset = {
    x: e.clientX - menuState.position.x,
    y: e.clientY - menuState.position.y,
  };

  document.addEventListener('mousemove', handleDragMove);
  document.addEventListener('mouseup', handleDragEnd);
}

/**
 * Handle touch start for mobile
 */
function handleTouchStart(e: TouchEvent): void {
  const touch = e.touches[0];
  dragStartTime = Date.now();

  dragOffset = {
    x: touch.clientX - menuState.position.x,
    y: touch.clientY - menuState.position.y,
  };

  document.addEventListener('touchmove', handleTouchMove, { passive: false });
  document.addEventListener('touchend', handleTouchEnd);
}

/**
 * Handle drag move
 */
function handleDragMove(e: MouseEvent): void {
  menuState.isDragging = true;
  menuState.position = {
    x: e.clientX - dragOffset.x,
    y: e.clientY - dragOffset.y,
  };
  updatePosition();

  // Close menu while dragging
  if (menuState.isOpen) {
    closeMenu();
  }
}

/**
 * Handle touch move
 */
function handleTouchMove(e: TouchEvent): void {
  e.preventDefault();
  const touch = e.touches[0];
  menuState.isDragging = true;
  menuState.position = {
    x: touch.clientX - dragOffset.x,
    y: touch.clientY - dragOffset.y,
  };
  updatePosition();

  if (menuState.isOpen) {
    closeMenu();
  }
}

/**
 * Handle drag end
 */
function handleDragEnd(): void {
  document.removeEventListener('mousemove', handleDragMove);
  document.removeEventListener('mouseup', handleDragEnd);

  setTimeout(() => {
    menuState.isDragging = false;
  }, 50);
}

/**
 * Handle touch end
 */
function handleTouchEnd(): void {
  document.removeEventListener('touchmove', handleTouchMove);
  document.removeEventListener('touchend', handleTouchEnd);

  // Toggle menu on quick tap
  if (Date.now() - dragStartTime < 200 && !menuState.isDragging) {
    toggleMenu();
  }

  setTimeout(() => {
    menuState.isDragging = false;
  }, 50);
}

/**
 * Add drag listeners
 */
function addDragListeners(): void {
  // Click outside to close
  document.addEventListener('click', (e) => {
    const container = document.getElementById(MENU_CONTAINER_ID);
    if (container && !container.contains(e.target as Node) && menuState.isOpen) {
      closeMenu();
    }
  });
}

/**
 * Add resize listener
 */
function addResizeListener(): void {
  window.addEventListener('resize', () => {
    updatePosition();
  });
}

/**
 * Toggle icon SVG (hamburger/close morph)
 */
function getToggleIcon(): string {
  return `
    <svg class="toggle-icon icon-menu" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
    <svg class="toggle-icon icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
    <svg class="toggle-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  `;
}

/**
 * Menu CSS styles - Glassmorphism + Motion-Driven
 */
function getMenuStyles(): string {
  return `
    /* Container */
    #${MENU_CONTAINER_ID} {
      position: fixed;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      touch-action: none;
      user-select: none;
    }

    /* Main toggle button */
    .menu-toggle {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      border: none;
      background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
      color: white;
      cursor: grab;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow:
        0 4px 20px rgba(59, 130, 246, 0.4),
        0 0 0 0 rgba(59, 130, 246, 0.3);
      transition:
        transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
        box-shadow 0.3s ease,
        background 0.3s ease;
      position: relative;
      overflow: hidden;
    }

    .menu-toggle:active {
      cursor: grabbing;
    }

    .menu-toggle:hover {
      transform: scale(1.08);
      box-shadow:
        0 8px 30px rgba(59, 130, 246, 0.5),
        0 0 0 4px rgba(59, 130, 246, 0.15);
    }

    .menu-toggle::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: 50%;
      background: linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 50%);
      pointer-events: none;
    }

    /* Tooltip */
    .menu-toggle::after {
      content: attr(data-tooltip);
      position: absolute;
      right: calc(100% + 12px);
      top: 50%;
      transform: translateY(-50%) scale(0.9);
      background: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(8px);
      color: white;
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      white-space: nowrap;
      opacity: 0;
      visibility: hidden;
      transition: all 0.2s ease;
      pointer-events: none;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    }

    .menu-toggle:hover::after {
      opacity: 1;
      visibility: visible;
      transform: translateY(-50%) scale(1);
    }

    /* Toggle icons */
    .toggle-icon {
      width: 24px;
      height: 24px;
      transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
      position: absolute;
    }

    .icon-menu {
      opacity: 1;
      transform: rotate(0deg) scale(1);
    }

    .icon-close {
      opacity: 0;
      transform: rotate(-90deg) scale(0.5);
    }

    .menu-toggle.open .icon-menu {
      opacity: 0;
      transform: rotate(90deg) scale(0.5);
    }

    .menu-toggle.open .icon-close {
      opacity: 1;
      transform: rotate(0deg) scale(1);
    }

    /* Loading spinner */
    .toggle-spinner {
      width: 24px;
      height: 24px;
      display: none;
      animation: spin 1s linear infinite;
      position: absolute;
    }

    .menu-toggle.loading .icon-menu,
    .menu-toggle.loading .icon-close {
      display: none;
    }

    .menu-toggle.loading .toggle-spinner {
      display: block;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* Menu items container */
    .menu-items {
      position: absolute;
      top: 28px;
      left: 28px;
      pointer-events: none;
    }

    #${MENU_CONTAINER_ID}.open .menu-items {
      pointer-events: auto;
    }

    /* Individual menu items */
    .menu-item {
      position: absolute;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: none;
      background: var(--item-color, #3B82F6);
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
      transform: translate(-50%, -50%) scale(0);
      opacity: 0;
      transition:
        transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
        opacity 0.3s ease,
        box-shadow 0.2s ease;
      transition-delay: var(--item-delay);
    }

    .menu-item svg {
      width: 20px;
      height: 20px;
    }

    .menu-item:hover {
      transform: translate(calc(-50% + var(--item-x)), calc(-50% + var(--item-y))) scale(1.15) !important;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
    }

    .menu-item:active {
      transform: translate(calc(-50% + var(--item-x)), calc(-50% + var(--item-y))) scale(0.95) !important;
    }

    /* Tooltip for menu items */
    .menu-item::after {
      content: attr(data-tooltip);
      position: absolute;
      right: calc(100% + 10px);
      top: 50%;
      transform: translateY(-50%) translateX(5px);
      background: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(8px);
      color: white;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;
      opacity: 0;
      visibility: hidden;
      transition: all 0.15s ease;
      pointer-events: none;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }

    .menu-item:hover::after {
      opacity: 1;
      visibility: visible;
      transform: translateY(-50%) translateX(0);
    }

    /* Open state - expand items */
    #${MENU_CONTAINER_ID}.open .menu-item {
      opacity: 1;
      transform: translate(calc(-50% + var(--item-x)), calc(-50% + var(--item-y))) scale(1);
    }

    /* Backdrop blur overlay when open */
    #${MENU_CONTAINER_ID}::before {
      content: '';
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0);
      pointer-events: none;
      transition: background 0.3s ease;
      z-index: -1;
    }

    #${MENU_CONTAINER_ID}.open::before {
      background: rgba(0, 0, 0, 0.1);
    }

    /* Pulse animation for attention */
    @keyframes pulse {
      0%, 100% { box-shadow: 0 4px 20px rgba(59, 130, 246, 0.4), 0 0 0 0 rgba(59, 130, 246, 0.3); }
      50% { box-shadow: 0 4px 20px rgba(59, 130, 246, 0.4), 0 0 0 8px rgba(59, 130, 246, 0); }
    }

    .menu-toggle.pulse {
      animation: pulse 2s ease-in-out infinite;
    }

    /* Toast notification */
    .ai-toast {
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      background: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(12px);
      border-radius: 12px;
      padding: 12px 20px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 14px;
      color: white;
      opacity: 0;
      animation: toastIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      max-width: 320px;
      z-index: 1000000;
    }

    .ai-toast.success {
      border-left: 4px solid #22C55E;
    }

    .ai-toast.error {
      border-left: 4px solid #EF4444;
    }

    .ai-toast.fade-out {
      animation: toastOut 0.3s ease forwards;
    }

    @keyframes toastIn {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(20px) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0) scale(1);
      }
    }

    @keyframes toastOut {
      from {
        opacity: 1;
        transform: translateX(-50%) translateY(0) scale(1);
      }
      to {
        opacity: 0;
        transform: translateX(-50%) translateY(-10px) scale(0.95);
      }
    }

    /* Cancel button */
    .ai-cancel-btn {
      position: absolute;
      top: -50px;
      left: 50%;
      transform: translateX(-50%) scale(0);
      padding: 8px 16px;
      border-radius: 20px;
      border: none;
      background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%);
      color: white;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
      transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      white-space: nowrap;
    }

    #${MENU_CONTAINER_ID}.open .ai-cancel-btn,
    .menu-toggle.loading ~ .ai-cancel-btn {
      transform: translateX(-50%) scale(1);
    }

    .ai-cancel-btn:hover {
      transform: translateX(-50%) scale(1.05);
    }

    .ai-cancel-btn:active {
      transform: translateX(-50%) scale(0.95);
    }

    /* Debug panel */
    .ai-debug-panel {
      position: fixed;
      bottom: 100px;
      right: 80px;
      width: 400px;
      max-height: 300px;
      background: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.3);
      overflow: hidden;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 12px;
      z-index: 999998;
      animation: slideUp 0.3s ease;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .debug-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 14px;
      background: rgba(59, 130, 246, 0.2);
      color: #60A5FA;
      font-weight: 600;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .debug-close {
      background: none;
      border: none;
      color: #94A3B8;
      font-size: 18px;
      cursor: pointer;
      line-height: 1;
      padding: 2px 6px;
      border-radius: 4px;
      transition: all 0.15s ease;
    }

    .debug-close:hover {
      color: #EF4444;
      background: rgba(239, 68, 68, 0.1);
    }

    .debug-content {
      padding: 14px;
      color: #E2E8F0;
      max-height: 240px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.6;
    }

    .debug-content::-webkit-scrollbar {
      width: 6px;
    }

    .debug-content::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.05);
    }

    .debug-content::-webkit-scrollbar-thumb {
      background: rgba(59, 130, 246, 0.3);
      border-radius: 3px;
    }

    .debug-content::-webkit-scrollbar-thumb:hover {
      background: rgba(59, 130, 246, 0.5);
    }

    /* Reduced motion preference */
    @media (prefers-reduced-motion: reduce) {
      .menu-toggle,
      .menu-item,
      .ai-toast,
      .ai-cancel-btn,
      .ai-debug-panel {
        transition-duration: 0.01ms !important;
        animation-duration: 0.01ms !important;
      }
    }
  `;
}

/**
 * Show toast notification
 */
export function showMenuToast(message: string, type: 'success' | 'error' = 'success'): void {
  // Remove existing toast
  const existing = document.querySelector('.ai-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `ai-toast ${type}`;

  const icon = type === 'success'
    ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22C55E" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
    : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;

  toast.innerHTML = `${icon}<span>${message}</span>`;
  document.body.appendChild(toast);

  // Auto remove
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/**
 * Show debug panel
 */
export function showMenuDebugPanel(): void {
  if (document.querySelector('.ai-debug-panel')) return;

  const panel = document.createElement('div');
  panel.className = 'ai-debug-panel';
  panel.innerHTML = `
    <div class="debug-header">
      <span>🔍 AI Stream Debug</span>
      <button class="debug-close" onclick="this.closest('.ai-debug-panel').remove()">×</button>
    </div>
    <div class="debug-content"></div>
  `;
  document.body.appendChild(panel);
}

/**
 * Update debug stream content
 */
export function updateMenuDebugStream(_chunk: string, fullText: string): void {
  let panel = document.querySelector('.ai-debug-panel');
  if (!panel) {
    showMenuDebugPanel();
    panel = document.querySelector('.ai-debug-panel');
  }

  const content = panel?.querySelector('.debug-content');
  if (content) {
    content.textContent = fullText;
    content.scrollTop = content.scrollHeight;
  }
}

/**
 * Hide debug panel
 */
export function hideMenuDebugPanel(): void {
  const panel = document.querySelector('.ai-debug-panel');
  if (panel) panel.remove();
}

/**
 * Show cancel button
 */
export function showCancelButton(onCancel: () => void): void {
  const container = document.getElementById(MENU_CONTAINER_ID);
  if (!container || container.querySelector('.ai-cancel-btn')) return;

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'ai-cancel-btn';
  cancelBtn.textContent = '✕ Cancel';
  cancelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    onCancel();
    hideCancelButton();
  });
  container.appendChild(cancelBtn);
}

/**
 * Hide cancel button
 */
export function hideCancelButton(): void {
  const cancelBtn = document.querySelector('.ai-cancel-btn');
  if (cancelBtn) cancelBtn.remove();
}
