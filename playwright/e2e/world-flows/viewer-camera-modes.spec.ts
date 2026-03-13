import { expect, test } from "@playwright/test";

import { attachBrowserDebugListeners } from "../../browserDebugTestUtils";

const SAVED_WORLDS_KEY = "skill-garden.saved-worlds.v1";

test("supports debug-gated viewer camera mode toggling and reset", async ({ page, baseURL }) => {
  const pageErrors = attachBrowserDebugListeners(page);
  const worldId = "viewer-camera-debug-world";

  await page.addInitScript(
    ({ storageKey, nextWorldId }) => {
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
      localStorage.setItem(
        storageKey,
        JSON.stringify([
          {
            id: nextWorldId,
            name: "Viewer Camera Debug World",
            layout,
            objectCount: 1,
            createdAt: now,
            updatedAt: now
          }
        ])
      );
    },
    { storageKey: SAVED_WORLDS_KEY, nextWorldId: worldId }
  );

  await page.goto(`${baseURL}/?renderer=webgl&appMode=viewer&worldId=${worldId}&debugBrowserLogs=1`, {
    waitUntil: "domcontentloaded"
  });

  await expect(page.locator("#viewer-panel")).toHaveAttribute("data-viewer-load-state", "ready");

  const toggleButton = page.locator("#viewer-toggle-camera-mode");
  const legend = page.locator(".viewer-controls-legend");

  await expect(toggleButton).toBeVisible();
  await expect(toggleButton).toHaveText("Dev Free Camera");
  await expect(toggleButton).toHaveAttribute("aria-pressed", "false");
  await expect(legend).toContainText("Shift+F: free cam");

  await toggleButton.click();
  await expect(toggleButton).toHaveText("Presentation Camera");
  await expect(toggleButton).toHaveAttribute("aria-pressed", "true");
  await expect(legend).toContainText("W/A/S/D: move");

  await page.keyboard.press("Shift+F");
  await expect(toggleButton).toHaveText("Dev Free Camera");
  await expect(toggleButton).toHaveAttribute("aria-pressed", "false");

  await page.keyboard.press("Shift+F");
  await expect(toggleButton).toHaveText("Presentation Camera");
  await expect(toggleButton).toHaveAttribute("aria-pressed", "true");

  await page.keyboard.press("r");
  await expect(toggleButton).toHaveText("Dev Free Camera");
  await expect(toggleButton).toHaveAttribute("aria-pressed", "false");
  await expect(legend).toContainText("Shift+F: free cam");

  expect(pageErrors, "No uncaught browser page errors should occur during camera mode toggling.").toHaveLength(0);
});

test("hides dev camera controls when debug mode is not enabled", async ({ page, baseURL }) => {
  const pageErrors = attachBrowserDebugListeners(page);
  const worldId = "viewer-camera-standard-world";

  await page.addInitScript(
    ({ storageKey, nextWorldId }) => {
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
      localStorage.setItem(
        storageKey,
        JSON.stringify([
          {
            id: nextWorldId,
            name: "Viewer Camera Standard World",
            layout,
            objectCount: 1,
            createdAt: now,
            updatedAt: now
          }
        ])
      );
    },
    { storageKey: SAVED_WORLDS_KEY, nextWorldId: worldId }
  );

  await page.goto(`${baseURL}/?renderer=webgl&appMode=viewer&worldId=${worldId}`, {
    waitUntil: "domcontentloaded"
  });

  await expect(page.locator("#viewer-panel")).toHaveAttribute("data-viewer-load-state", "ready");
  await expect(page.locator("#viewer-toggle-camera-mode")).toHaveCount(0);
  await expect(page.locator(".viewer-controls-legend")).not.toContainText("Shift+F");

  await page.keyboard.press("Shift+F");
  await expect(page.locator("#viewer-toggle-camera-mode")).toHaveCount(0);
  await expect(page.locator("#viewer-reset-view")).toBeEnabled();

  expect(pageErrors, "No uncaught browser page errors should occur for non-debug viewer camera flow.").toHaveLength(0);
});
