import { expect, test } from "@playwright/test";

import { attachBrowserDebugListeners } from "../../browserDebugTestUtils";

const SAVED_WORLDS_KEY = "skill-garden.saved-worlds.v1";

test("recovers from corrupted saved-worlds storage", async ({ page, baseURL }) => {
  const pageErrors = attachBrowserDebugListeners(page);

  await page.addInitScript((storageKey) => {
    localStorage.setItem(storageKey, "{ this is not valid json");
  }, SAVED_WORLDS_KEY);

  await page.goto(`${baseURL}/?renderer=webgl&appMode=menu&debugBrowserLogs=1`, {
    waitUntil: "domcontentloaded"
  });

  await expect(page.locator("#menu-panel")).toBeVisible();
  await expect(page.locator(".menu-notice")).toContainText("Saved worlds data was corrupted and has been reset.");
  await expect(page.locator(".menu-world-card")).toHaveCount(0);

  expect(pageErrors, "No uncaught browser page errors should occur during corrupted-storage recovery.").toHaveLength(0);
});
