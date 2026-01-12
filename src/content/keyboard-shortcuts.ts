import { logger } from '@/utils/logger';

type ShortcutHandler = () => void;

interface Shortcut {
  key: string;
  alt?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  handler: ShortcutHandler;
  description: string;
}

const shortcuts: Shortcut[] = [];

/**
 * Register keyboard shortcuts
 */
export function initKeyboardShortcuts(): void {
  document.addEventListener('keydown', handleKeydown);
  logger.log('Keyboard shortcuts initialized');
}

/**
 * Add a new keyboard shortcut
 */
export function registerShortcut(shortcut: Shortcut): void {
  shortcuts.push(shortcut);
}

/**
 * Remove all keyboard shortcuts
 */
export function removeKeyboardShortcuts(): void {
  document.removeEventListener('keydown', handleKeydown);
  shortcuts.length = 0;
}

function handleKeydown(event: KeyboardEvent): void {
  const target = event.target as HTMLElement;
  if (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable
  ) {
    return;
  }

  for (const shortcut of shortcuts) {
    const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
    const altMatches = !!shortcut.alt === event.altKey;
    const ctrlMatches = !!shortcut.ctrl === (event.ctrlKey || event.metaKey);
    const shiftMatches = !!shortcut.shift === event.shiftKey;

    if (keyMatches && altMatches && ctrlMatches && shiftMatches) {
      event.preventDefault();
      shortcut.handler();
      break;
    }
  }
}
