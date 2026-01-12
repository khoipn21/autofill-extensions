import { useState } from 'react';
import { Wand2, Settings, RefreshCw, CheckCircle, AlertTriangle, Bug, Eye, XCircle } from 'lucide-react';
import { StatusIndicator } from '../components/StatusIndicator';
import { usePopupStore } from '../store';
import { sendToContent, sendToBackground } from '@/shared/messages';
import { isValidUrl } from '@/utils/validators';

type FillStatus = 'ready' | 'analyzing' | 'processing' | 'filling' | 'complete' | 'error';

export function MainPage() {
  const { settings, updateSettings, setPage } = usePopupStore();
  const [status, setStatus] = useState<FillStatus>('ready');
  const [message, setMessage] = useState('');
  const [stats, setStats] = useState<{ success: number; failed: number } | null>(null);

  const handleCancel = async () => {
    try {
      const response = await sendToBackground<void, boolean>({
        type: 'CANCEL_REQUEST',
      });
      if (response.success) {
        setStatus('ready');
        setMessage('Cancelled');
      }
    } catch (err) {
      console.warn('Failed to cancel:', err);
    }
  };

  const toggleDebugMode = async () => {
    await updateSettings({ debugMode: !settings.debugMode });
  };

  const toggleVisionRecheck = async () => {
    await updateSettings({ enableVisionRecheck: !settings.enableVisionRecheck });
  };

  const handleAutoFill = async () => {
    setStatus('analyzing');
    setMessage('Starting auto-fill...');
    setStats(null);

    try {
      // Validate active tab URL before sending messages
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url) {
        throw new Error('No active tab found');
      }

      if (!isValidUrl(tab.url)) {
        setStatus('error');
        setMessage('Please open a webpage to use auto-fill');
        return;
      }

      // Trigger auto-fill via content script (runs independently of popup)
      // This ensures the process continues even if popup closes
      const response = await sendToContent<void, void>({
        type: 'TRIGGER_AUTOFILL',
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to trigger auto-fill');
      }

      // Show success message (actual fill happens in content script)
      setStatus('complete');
      setMessage('Auto-fill started! You can close this popup.');

      // Reset to ready after delay
      setTimeout(() => {
        setStatus('ready');
        setMessage('');
      }, 3000);
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const statusMessage = {
    ready: 'Ready to auto-fill',
    analyzing: message,
    processing: message,
    filling: message,
    complete: message,
    error: message,
  };

  const getStatusType = () => {
    switch (status) {
      case 'ready':
        return 'ready';
      case 'analyzing':
      case 'processing':
      case 'filling':
        return 'loading';
      case 'complete':
        return 'ready';
      case 'error':
        return 'error';
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">AI Auto-Fill</h1>
        <button
          onClick={() => setPage('settings')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Settings className="h-5 w-5 text-gray-500" />
        </button>
      </div>

      <StatusIndicator status={getStatusType()} message={statusMessage[status]} />

      {stats && (
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-1 text-green-600">
            <CheckCircle className="h-4 w-4" />
            {stats.success} filled
          </div>
          {stats.failed > 0 && (
            <div className="flex items-center gap-1 text-red-600">
              <AlertTriangle className="h-4 w-4" />
              {stats.failed} failed
            </div>
          )}
        </div>
      )}

      <button
        onClick={handleAutoFill}
        disabled={['analyzing', 'processing', 'filling'].includes(status)}
        className="w-full py-3 px-4 bg-primary text-white rounded-lg font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
      >
        {['analyzing', 'processing', 'filling'].includes(status) ? (
          <>
            <RefreshCw className="h-5 w-5 animate-spin" />
            {status === 'analyzing'
              ? 'Analyzing...'
              : status === 'processing'
                ? 'AI Processing...'
                : 'Filling...'}
          </>
        ) : (
          <>
            <Wand2 className="h-5 w-5" />
            Auto-Fill This Form
          </>
        )}
      </button>

      {/* Cancel Button - shown during processing */}
      {['analyzing', 'processing', 'filling'].includes(status) && (
        <button
          onClick={handleCancel}
          className="w-full py-2 px-4 border border-red-300 text-red-600 rounded-lg font-medium hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
        >
          <XCircle className="h-4 w-4" />
          Cancel
        </button>
      )}

      {/* Debug Section */}
      <div className="border-t pt-3 mt-2">
        <div className="flex items-center justify-between gap-2">
          {/* Debug Mode Toggle */}
          <button
            onClick={toggleDebugMode}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors ${
              settings.debugMode
                ? 'bg-orange-100 text-orange-700 border border-orange-300'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
            title="Show streaming AI output on page"
          >
            <Bug className="h-3.5 w-3.5" />
            Debug {settings.debugMode ? 'ON' : 'OFF'}
          </button>

          {/* Vision Recheck Toggle */}
          <button
            onClick={toggleVisionRecheck}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors ${
              settings.enableVisionRecheck
                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
            title="Use screenshot for recheck (uses more tokens)"
          >
            <Eye className="h-3.5 w-3.5" />
            Vision {settings.enableVisionRecheck ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      <div className="text-xs text-gray-400 text-center">
        {settings.activeProvider === 'gemini' ? (
          <>Provider: Gemini | Model: {settings.providers?.gemini?.model || 'gemini-2.5-flash'}</>
        ) : (
          <>Provider: OpenRouter | Model: {(settings.model || '').split('/').pop()}</>
        )}
      </div>
    </div>
  );
}
