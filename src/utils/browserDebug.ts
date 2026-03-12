export function isBrowserDebugEnabled(): boolean {
  if (import.meta.env.VITE_DEBUG_BROWSER_LOGS === "true") {
    return true;
  }

  if (typeof window === "undefined") {
    return false;
  }

  return new URLSearchParams(window.location.search).get("debugBrowserLogs") === "1";
}

export function logBrowserDebug(event: string, details?: Record<string, unknown>): void {
  if (!isBrowserDebugEnabled()) {
    return;
  }

  if (details) {
    console.log(`[browser-debug] ${event}`, details);
    return;
  }

  console.log(`[browser-debug] ${event}`);
}

export function browserDebugError(event: string, error: unknown): void {
  if (!isBrowserDebugEnabled()) {
    return;
  }

  if (error instanceof Error) {
    console.error(`[browser-debug] ${event}`, {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    return;
  }

  console.error(`[browser-debug] ${event}`, {
    error
  });
}