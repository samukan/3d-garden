import { expect, test } from "@playwright/test";

import { attachBrowserDebugListeners } from "../../browserDebugTestUtils";

const SAVED_WORLDS_KEY = "skill-garden.saved-worlds.v1";

test("renders a stable empty-world viewer state", async ({ page, baseURL }) => {
  const pageErrors = attachBrowserDebugListeners(page);

  await page.addInitScript((storageKey) => {
    const now = new Date().toISOString();
    localStorage.setItem(
      storageKey,
      JSON.stringify([
        {
          id: "empty-world",
          name: "Empty World",
          layout: JSON.stringify({ objects: [] }, null, 2),
          objectCount: 0,
          createdAt: now,
          updatedAt: now
        }
      ])
    );
  }, SAVED_WORLDS_KEY);

  await page.goto(`${baseURL}/?renderer=webgl&appMode=viewer&worldId=empty-world&debugBrowserLogs=1`, {
    waitUntil: "domcontentloaded"
  });

  await expect(page.locator("#viewer-panel")).toHaveAttribute("data-viewer-load-state", "ready");
  await expect(page.locator("#viewer-panel")).toContainText("Objects: 0");
  await expect(page.locator("#viewer-reset-view")).toBeEnabled();

  expect(pageErrors, "No uncaught browser page errors should occur for empty viewer worlds.").toHaveLength(0);
});
