import { useEffect } from 'react';
import { SetupPage } from './pages/SetupPage';
import { MainPage } from './pages/MainPage';
import { SettingsPage } from './pages/SettingsPage';
import { usePopupStore } from './store';

export default function App() {
  const { currentPage, loading, error, loadSettings, clearError } = usePopupStore();

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  if (loading && currentPage === 'setup') {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 text-sm">{error}</p>
          <button onClick={clearError} className="mt-2 text-sm text-red-600 hover:underline">
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  switch (currentPage) {
    case 'setup':
      return <SetupPage />;
    case 'main':
      return <MainPage />;
    case 'settings':
      return <SettingsPage />;
  }
}
