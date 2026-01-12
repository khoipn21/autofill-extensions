import { CheckCircle, AlertCircle, Loader } from 'lucide-react';

interface StatusIndicatorProps {
  status: 'ready' | 'loading' | 'error' | 'no-key';
  message?: string;
}

const statusConfig = {
  ready: {
    icon: CheckCircle,
    color: 'text-green-500',
    bg: 'bg-green-50',
    defaultMessage: 'Ready to auto-fill',
  },
  loading: {
    icon: Loader,
    color: 'text-blue-500',
    bg: 'bg-blue-50',
    defaultMessage: 'Processing...',
  },
  error: {
    icon: AlertCircle,
    color: 'text-red-500',
    bg: 'bg-red-50',
    defaultMessage: 'An error occurred',
  },
  'no-key': {
    icon: AlertCircle,
    color: 'text-yellow-500',
    bg: 'bg-yellow-50',
    defaultMessage: 'API key required',
  },
};

export function StatusIndicator({ status, message }: StatusIndicatorProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className={`p-3 rounded-lg ${config.bg} flex items-center gap-2`}>
      <Icon
        className={`h-5 w-5 ${config.color} ${status === 'loading' ? 'animate-spin' : ''}`}
      />
      <span className="text-sm text-gray-700">{message || config.defaultMessage}</span>
    </div>
  );
}
