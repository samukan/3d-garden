import type { Page } from "@playwright/test";

function formatLocation(url: string, lineNumber: number, columnNumber: number): string {
  if (!url) {
    return "";
  }

  try {
    const parsedUrl = new URL(url);
    return ` (${parsedUrl.pathname}:${lineNumber}:${columnNumber})`;
  } catch {
    return ` (${url}:${lineNumber}:${columnNumber})`;
  }
}

export function attachBrowserDebugListeners(page: Page): Error[] {
  const pageErrors: Error[] = [];

  page.on("console", (message) => {
    const location = message.location();
    const suffix = formatLocation(location.url, location.lineNumber, location.columnNumber);
    console.log(`[browser:${message.type()}] ${message.text()}${suffix}`);
  });

  page.on("pageerror", (error) => {
    pageErrors.push(error);
    console.error(`[browser:pageerror] ${error.name}: ${error.message}`);
  });

  return pageErrors;
}

export function normalizeInlineText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}