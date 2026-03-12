import { expect, test } from "@playwright/test";

import { attachBrowserDebugListeners } from "../../browserDebugTestUtils";

const SAVED_WORLDS_KEY = "skill-garden.saved-worlds.v1";

test("shows missing-asset diagnostics in viewer mode", async ({ page, baseURL }) => {
  const pageErrors = attachBrowserDebugListeners(page);

  await page.addInitScript((storageKey) => {
    const now = new Date().toISOString();
    const layout = JSON.stringify(
      {
        objects: [
          {
            id: "builder-object-1",
            assetId: "missing-asset-id",
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
        id: "world-missing-asset",
        name: "Missing Asset World",
        layout,
        objectCount: 1,
        createdAt: now,
        updatedAt: now
      }
    ];

    localStorage.setItem(storageKey, JSON.stringify(savedWorlds));
  }, SAVED_WORLDS_KEY);

  await page.goto(`${baseURL}/?renderer=webgl&appMode=viewer&worldId=world-missing-asset&debugBrowserLogs=1`, {
    waitUntil: "domcontentloaded"
  });

  await expect(page.locator("#app-title")).toHaveText("Missing Asset World");
  await expect(page.locator("#viewer-panel")).toHaveAttribute("data-viewer-load-state", "partial");
  await expect(page.locator("#viewer-panel")).toContainText("Missing asset");

  expect(pageErrors, "No uncaught browser page errors should occur while showing missing-asset diagnostics.").toHaveLength(0);
});
