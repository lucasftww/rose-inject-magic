const MAX_ERRORS = 100;
const STORAGE_KEY = 'site_error_log';

interface TrackedError {
  id: string;
  timestamp: string;
  type: 'js-error' | 'unhandled-rejection' | 'network-error' | 'react-error';
  message: string;
  stack?: string;
  url?: string;
  line?: number;
  col?: number;
  componentStack?: string;
}

function getErrors(): TrackedError[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveError(error: TrackedError) {
  const errors = getErrors();
  errors.unshift(error);
  if (errors.length > MAX_ERRORS) errors.length = MAX_ERRORS;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(errors));
}

export function initErrorTracker() {
  // JS errors
  window.addEventListener('error', (e) => {
    saveError({
      id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2),
      timestamp: new Date().toISOString(),
      type: 'js-error',
      message: e.message || String(e),
      stack: e.error?.stack,
      url: e.filename,
      line: e.lineno,
      col: e.colno,
    });
  });

  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason;
    saveError({
      id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2),
      timestamp: new Date().toISOString(),
      type: 'unhandled-rejection',
      message: reason?.message || String(reason),
      stack: reason?.stack,
    });
  });

  // Patch fetch to track network errors
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    try {
      const response = await originalFetch(...args);
      if (!response.ok && response.status >= 500) {
        const url = typeof args[0] === 'string' ? args[0] : args[0] instanceof Request ? args[0].url : String(args[0]);
        saveError({
          id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2),
          timestamp: new Date().toISOString(),
          type: 'network-error',
          message: `HTTP ${response.status} ${response.statusText}`,
          url,
        });
      }
      return response;
    } catch (err: any) {
      const url = typeof args[0] === 'string' ? args[0] : args[0] instanceof Request ? args[0].url : String(args[0]);
      saveError({
        id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2),
        timestamp: new Date().toISOString(),
        type: 'network-error',
        message: err?.message || 'Network request failed',
        url,
        stack: err?.stack,
      });
      throw err;
    }
  };

  // silent init — no console output
}

