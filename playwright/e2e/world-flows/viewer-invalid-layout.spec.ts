import { expect, test } from "@playwright/test";

import { attachBrowserDebugListeners } from "../../browserDebugTestUtils";

const SAVED_WORLDS_KEY = "skill-garden.saved-worlds.v1";

test("shows viewer-context error for invalid saved world layout", async ({ page, baseURL }) => {
  const pageErrors = attachBrowserDebugListeners(page);

  await page.addInitScript((storageKey) => {
    const now = new Date().toISOString();
    localStorage.setItem(
      storageKey,
      JSON.stringify([
        {
          id: "invalid-layout-world",
          name: "Invalid Layout World",
          layout: "{ not valid json",
          objectCount: 0,
          createdAt: now,
          updatedAt: now
        }
      ])
    );
  }, SAVED_WORLDS_KEY);

  await page.goto(`${baseURL}/?renderer=webgl&appMode=viewer&worldId=invalid-layout-world&debugBrowserLogs=1`, {
    waitUntil: "domcontentloaded"
  });

  await expect(page.locator("#viewer-panel")).toHaveAttribute("data-viewer-load-state", "error");
  await expect(page.locator("#viewer-panel")).toContainText("could not be opened");
  await expect(page.locator("#app-menu-link")).toBeVisible();

  expect(pageErrors, "No uncaught browser page errors should occur for invalid viewer layouts.").toHaveLength(0);
});
