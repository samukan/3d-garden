import { expect, test } from "@playwright/test";

import { attachBrowserDebugListeners } from "../browserDebugTestUtils";

const SAVED_WORLDS_KEY = "skill-garden.saved-worlds.v1";

test("boots viewer mode for a saved world", async ({ page, baseURL }) => {
  const pageErrors = attachBrowserDebugListeners(page);

  await page.addInitScript((storageKey) => {
    const now = new Date().toISOString();
    const layout = JSON.stringify(
      {
        objects: [
          {
            id: "builder-object-1",
            assetId: "tree",
            position: { x: 0, y: 0, z: 0 },
            rotationY: 0,
            scale: 1
          }
        ]
      },
      null,
      2
    );

    const savedWorlds = [
      {
        id: "world-viewer-smoke",
        name: "Viewer Smoke World",
        layout,
        objectCount: 1,
        createdAt: now,
        updatedAt: now
      }
    ];

    localStorage.setItem(storageKey, JSON.stringify(savedWorlds));
  }, SAVED_WORLDS_KEY);

  await page.goto(`${baseURL}/?renderer=webgl&appMode=viewer&worldId=world-viewer-smoke&debugBrowserLogs=1`, {
    waitUntil: "domcontentloaded"
  });

  await expect(page.locator("#renderCanvas")).toBeVisible();
  await expect(page.locator("#app-edit-link")).toBeVisible();
  await expect(page.locator("#app-title")).toHaveText("Viewer Smoke World");

  expect(pageErrors, "No uncaught browser page errors should occur during viewer bootstrap.").toHaveLength(0);
});
