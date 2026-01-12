import type { DetectedField } from '@/shared/types';
import { logger } from '@/utils/logger';

/**
 * Handle popup/modal-based field selection
 * Opens the modal, navigates to the target value, and selects it
 */
export async function fillPopupField(
  field: DetectedField,
  value: string
): Promise<boolean> {
  logger.log(`Filling popup field: ${field.label} with value: ${value}`);

  if (!field.popupTriggerSelector) {
    logger.error('No popup trigger selector for field:', field.id);
    return false;
  }

  try {
    // 1. Find and click the trigger element to open popup
    const trigger = document.querySelector(field.popupTriggerSelector) as HTMLElement;
    if (!trigger) {
      throw new Error(`Popup trigger not found: ${field.popupTriggerSelector}`);
    }

    trigger.click();
    await waitForModal();

    // 2. Detect modal type and handle accordingly
    const modal = await findOpenModal();
    if (!modal) {
      throw new Error('Modal did not open');
    }

    // 3. Search for and select the value in the modal
    const success = await selectValueInModal(modal, value, field);

    // 4. Confirm selection if needed
    if (success) {
      await confirmModalSelection(modal);
    } else {
      await cancelModal(modal);
    }

    return success;
  } catch (error) {
    logger.error(`Failed to fill popup field ${field.id}:`, error);
    // Try to close any open modal
    await tryCloseModal();
    return false;
  }
}

/**
 * Wait for modal to appear
 */
async function waitForModal(timeout = 3000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const modal = document.querySelector(
      '.mantine-Modal-root, [role="dialog"], .mantine-Drawer-root'
    );
    if (modal) {
      await sleep(200); // Let modal animation complete
      return;
    }
    await sleep(100);
  }
  throw new Error('Modal did not appear within timeout');
}

/**
 * Find the currently open modal
 */
async function findOpenModal(): Promise<HTMLElement | null> {
  const selectors = [
    '.mantine-Modal-content',
    '.mantine-Modal-root [role="dialog"]',
    '.mantine-Drawer-content',
    '[role="dialog"]',
  ];

  for (const selector of selectors) {
    const modal = document.querySelector(selector) as HTMLElement;
    if (modal && isVisible(modal)) {
      return modal;
    }
  }
  return null;
}

/**
 * Select value in modal based on modal type
 */
async function selectValueInModal(
  modal: HTMLElement,
  value: string,
  _field: DetectedField
): Promise<boolean> {
  // Check for category modal (hierarchical tree selection)
  if (isCategoryModal(modal)) {
    return await handleCategoryModal(modal, value);
  }

  // Check for list/table selection
  if (hasListItems(modal)) {
    return await handleListModal(modal, value);
  }

  // Check for search-based selection
  const searchInput = modal.querySelector(
    'input[type="search"], input[type="text"], .mantine-TextInput-input'
  ) as HTMLInputElement;
  if (searchInput) {
    return await handleSearchModal(modal, searchInput, value);
  }

  // Fallback: try to find and click matching text
  return await findAndClickText(modal, value);
}

/**
 * Handle category modal with hierarchical tree navigation
 */
async function handleCategoryModal(
  modal: HTMLElement,
  targetCategory: string
): Promise<boolean> {
  logger.log('Handling category modal for:', targetCategory);

  // Parse category path if provided (e.g., "Electronics > Phones > Smartphones")
  const categoryParts = targetCategory.split('>').map((s) => s.trim());

  for (let i = 0; i < categoryParts.length; i++) {
    const part = categoryParts[i];
    await sleep(200);

    // Find category column or list
    const columns = modal.querySelectorAll(
      '[class*="CategoryColumn"], [class*="category-column"], .mantine-ScrollArea-root'
    );

    // Search in the appropriate column (or last available)
    const columnIndex = Math.min(i, columns.length - 1);
    const searchArea = columns[columnIndex] || modal;

    // Find matching category item
    const items = searchArea.querySelectorAll(
      '[class*="category-item"], [data-category], button, [role="option"], [role="treeitem"]'
    );

    let found = false;
    for (const item of items) {
      const text = item.textContent?.trim().toLowerCase();
      if (text && (text === part.toLowerCase() || text.includes(part.toLowerCase()))) {
        (item as HTMLElement).click();
        found = true;
        await sleep(300); // Wait for next level to load
        break;
      }
    }

    if (!found) {
      // Try text search as fallback
      found = await findAndClickText(searchArea as HTMLElement, part);
    }

    if (!found && i === categoryParts.length - 1) {
      logger.warn(`Could not find final category: ${part}`);
      return false;
    }
  }

  return true;
}

/**
 * Handle modal with list/table items
 */
async function handleListModal(modal: HTMLElement, value: string): Promise<boolean> {
  const listItems = modal.querySelectorAll(
    'tr, li, [role="option"], [role="row"], .mantine-Table-tr'
  );

  for (const item of listItems) {
    const text = item.textContent?.toLowerCase();
    if (text && text.includes(value.toLowerCase())) {
      // Click the item or find its select button
      const button = item.querySelector('button, [role="button"]') as HTMLElement;
      if (button) {
        button.click();
      } else {
        (item as HTMLElement).click();
      }
      await sleep(200);
      return true;
    }
  }

  return false;
}

/**
 * Handle modal with search input
 */
async function handleSearchModal(
  modal: HTMLElement,
  searchInput: HTMLInputElement,
  value: string
): Promise<boolean> {
  // Type search value
  searchInput.focus();
  searchInput.value = value;
  searchInput.dispatchEvent(new Event('input', { bubbles: true }));
  searchInput.dispatchEvent(new Event('change', { bubbles: true }));

  // Wait for search results
  await sleep(500);

  // Find and click first matching result
  const results = modal.querySelectorAll(
    '[role="option"], [data-combobox-option], li, tr, .search-result'
  );

  for (const result of results) {
    const text = result.textContent?.toLowerCase();
    if (text && text.includes(value.toLowerCase())) {
      (result as HTMLElement).click();
      await sleep(200);
      return true;
    }
  }

  return false;
}

/**
 * Find and click element containing specific text
 */
async function findAndClickText(container: HTMLElement, text: string): Promise<boolean> {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);

  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.textContent?.toLowerCase().includes(text.toLowerCase())) {
      const parent = node.parentElement;
      if (parent && isClickable(parent)) {
        parent.click();
        await sleep(200);
        return true;
      }
    }
  }

  return false;
}

/**
 * Confirm modal selection (click Select/Confirm button)
 */
async function confirmModalSelection(modal: HTMLElement): Promise<void> {
  // Look for confirm/select button in modal footer
  const confirmButtons = modal.querySelectorAll(
    'button[type="submit"], .mantine-Modal-footer button, button'
  );

  for (const btn of confirmButtons) {
    const text = btn.textContent?.toLowerCase();
    if (
      text &&
      (text.includes('select') ||
        text.includes('confirm') ||
        text.includes('ok') ||
        text.includes('선택') ||
        text.includes('확인'))
    ) {
      (btn as HTMLElement).click();
      await sleep(300);
      return;
    }
  }

  // If no explicit confirm button, the selection click might have closed it
  logger.log('No explicit confirm button found, assuming selection was immediate');
}

/**
 * Cancel and close modal
 */
async function cancelModal(modal: HTMLElement): Promise<void> {
  const cancelButtons = modal.querySelectorAll('button');

  for (const btn of cancelButtons) {
    const text = btn.textContent?.toLowerCase();
    if (
      text &&
      (text.includes('cancel') || text.includes('close') || text.includes('취소'))
    ) {
      (btn as HTMLElement).click();
      await sleep(200);
      return;
    }
  }

  // Try clicking modal backdrop
  const backdrop = document.querySelector('.mantine-Modal-overlay, .mantine-Overlay-root');
  if (backdrop) {
    (backdrop as HTMLElement).click();
  }
}

/**
 * Try to close any open modal (cleanup)
 */
async function tryCloseModal(): Promise<void> {
  const closeBtn = document.querySelector(
    '.mantine-Modal-close, [aria-label="Close"], [aria-label="close"]'
  );
  if (closeBtn) {
    (closeBtn as HTMLElement).click();
    await sleep(200);
  }
}

/**
 * Check if element is a category modal
 */
function isCategoryModal(modal: HTMLElement): boolean {
  const indicators = [
    '[class*="Category"]',
    '[class*="category"]',
    '[data-category-modal]',
  ];
  return indicators.some((selector) => modal.querySelector(selector) !== null);
}

/**
 * Check if modal has list items
 */
function hasListItems(modal: HTMLElement): boolean {
  return modal.querySelector('table, ul, ol, [role="listbox"]') !== null;
}

/**
 * Check if element is visible
 */
function isVisible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0'
  );
}

/**
 * Check if element is clickable
 */
function isClickable(element: HTMLElement): boolean {
  const clickableTags = ['A', 'BUTTON', 'INPUT', 'SELECT', 'LABEL'];
  if (clickableTags.includes(element.tagName)) return true;

  const role = element.getAttribute('role');
  if (role && ['button', 'link', 'option', 'menuitem', 'treeitem'].includes(role)) {
    return true;
  }

  const style = window.getComputedStyle(element);
  if (style.cursor === 'pointer') return true;

  return false;
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
