const isDev = import.meta.env.DEV;

/**
 * Development-only logger with API key masking
 */
export const logger = {
  log: (...args: unknown[]) => {
    if (isDev) {
      console.log('[Daun AutoFill]', ...maskSensitiveData(args));
    }
  },
  error: (...args: unknown[]) => {
    console.error('[Daun AutoFill Error]', ...maskSensitiveData(args));
  },
  warn: (...args: unknown[]) => {
    if (isDev) {
      console.warn('[Daun AutoFill]', ...maskSensitiveData(args));
    }
  },
};

function maskSensitiveData(args: unknown[]): unknown[] {
  return args.map((arg) => {
    if (typeof arg === 'string' && arg.startsWith('sk-or-')) {
      return arg.slice(0, 10) + '...' + arg.slice(-4);
    }
    if (typeof arg === 'object' && arg !== null) {
      return JSON.parse(
        JSON.stringify(arg, (key, value) => {
          if (key.toLowerCase().includes('key') && typeof value === 'string') {
            return value.slice(0, 10) + '...' + value.slice(-4);
          }
          return value;
        })
      );
    }
    return arg;
  });
}
