import { create } from 'zustand';
import type { ExtensionSettings } from '@/shared/types';
import { DEFAULT_SETTINGS } from '@/shared/constants';
import { getSettings, saveSettings } from '@/shared/storage';

interface PopupState {
  settings: ExtensionSettings;
  loading: boolean;
  error: string | null;
  currentPage: 'setup' | 'main' | 'settings';

  loadSettings: () => Promise<void>;
  updateSettings: (updates: Partial<ExtensionSettings>) => Promise<void>;
  setPage: (page: PopupState['currentPage']) => void;
  clearError: () => void;
}

export const usePopupStore = create<PopupState>((set) => ({
  settings: DEFAULT_SETTINGS,
  loading: true,
  error: null,
  currentPage: 'setup',

  loadSettings: async () => {
    set({ loading: true, error: null });
    try {
      const settings = await getSettings();
      const hasKey = Boolean(settings.apiKey);
      set({
        settings,
        loading: false,
        currentPage: hasKey ? 'main' : 'setup',
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        loading: false,
      });
    }
  },

  updateSettings: async (updates) => {
    set({ loading: true, error: null });
    try {
      await saveSettings(updates);
      set((state) => ({
        settings: { ...state.settings, ...updates },
        loading: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Unknown error',
        loading: false,
      });
    }
  },

  setPage: (page) => set({ currentPage: page }),
  clearError: () => set({ error: null }),
}));
