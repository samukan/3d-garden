import { expect, test } from "@playwright/test";

import { attachBrowserDebugListeners } from "../../browserDebugTestUtils";

const SAVED_WORLDS_KEY = "skill-garden.saved-worlds.v1";

test("supports save -> view -> edit roundtrip", async ({ page, baseURL }) => {
  const pageErrors = attachBrowserDebugListeners(page);

  await page.addInitScript((storageKey) => {
    const resetFlag = "__skillGardenSavedWorldsResetOnce";
    if (localStorage.getItem(resetFlag) === "1") {
      return;
    }

    localStorage.removeItem(storageKey);
    localStorage.setItem(resetFlag, "1");
  }, SAVED_WORLDS_KEY);

  await page.goto(`${baseURL}/?renderer=webgl&appMode=builder&debugBrowserLogs=1`, {
    waitUntil: "domcontentloaded"
  });

  await expect(page.locator("#builder-status")).toContainText("Builder ready", {
    timeout: 20_000
  });

  await page.locator("#builder-palette button").first().click();
  await page.locator("#builder-place-asset").click();
  await expect(page.locator("#builder-status")).toContainText("Placed");

  const worldName = `Roundtrip ${Date.now()}`;
  await page.locator("#builder-world-name").fill(worldName);
  await page.locator("#builder-save-world").click();

  await expect(page.locator("#builder-world-status")).toContainText("Saved", {
    timeout: 10_000
  });
  await expect(page.locator("#builder-view-world")).toBeEnabled();

  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });
  await page.locator("#builder-view-world").click();
  await expect(page.locator("#app-edit-link")).toBeVisible();
  await expect(page.locator("#app-title")).toHaveText(worldName);
  await expect(page.locator("#viewer-panel")).toBeVisible();
  await expect(page.locator("#viewer-panel")).toHaveAttribute("data-viewer-load-state", "ready");

  await page.locator("#app-edit-link").click();
  await expect(page.locator("#builder-workspace")).toBeVisible();
  await expect(page.locator("#builder-world-name")).toHaveValue(worldName);

  await page.locator("#builder-back-to-menu").click();
  await expect(page.locator("#menu-panel")).toBeVisible();
  await expect(page.locator(".menu-world-card", { hasText: worldName })).toBeVisible();

  expect(pageErrors, "No uncaught browser page errors should occur during save/view/edit flow.").toHaveLength(0);
});

test("preserves metadata camera routes through save and reopen flow", async ({ page, baseURL }) => {
  const pageErrors = attachBrowserDebugListeners(page);
  const cinematicEvents: string[] = [];
  page.on("console", (message) => {
    const text = message.text();
    if (!text.includes("[browser-debug] viewer-cinematic:")) {
      return;
    }

    cinematicEvents.push(text);
  });

  await page.addInitScript((storageKey) => {
    const resetFlag = "__skillGardenMetadataSavedWorldsResetOnce";
    if (localStorage.getItem(resetFlag) === "1") {
      return;
    }

    localStorage.removeItem(storageKey);
    localStorage.setItem(resetFlag, "1");
  }, SAVED_WORLDS_KEY);

  await page.goto(`${baseURL}/?renderer=webgl&appMode=builder&debugBrowserLogs=1`, {
    waitUntil: "domcontentloaded"
  });

  await expect(page.locator("#builder-status")).toContainText("Builder ready", {
    timeout: 20_000
  });

  await page.locator("#builder-advanced-tools-toggle").click();
  await expect(page.locator("#builder-advanced-tools-panel")).toBeVisible();

  const metadataLayout = JSON.stringify(
    {
      version: 1,
      objects: [
        {
          id: "builder-object-1",
          assetId: "tree",
          position: { x: 0, y: 0, z: 0 },
          rotationY: 0,
          scale: 1
        }
      ],
      metadata: {
        cameraRoutes: {
          defaultRouteId: "builder-saved-metadata-route",
          routes: [
            {
              id: "builder-saved-metadata-route",
              name: "Saved Metadata Route",
              loop: false,
              timing: {
                mode: "duration",
                totalDurationMs: 3200
              },
              easing: "easeInOutSine",
              points: [
                {
                  position: [20, 11, -14],
                  lookAt: [0, 2, 0],
                  dwellMs: 250
                },
                {
                  position: [9, 9, -9],
                  lookAt: [1, 1.7, 1.2]
                }
              ]
            }
          ]
        }
      }
    },
    null,
    2
  );

  await page.locator("#builder-layout-json").fill(metadataLayout);
  await page.locator("#builder-import").click();
  await expect(page.locator("#builder-status")).toContainText("Imported 1 object", {
    timeout: 10_000
  });

  const worldName = `Metadata Roundtrip ${Date.now()}`;
  await page.locator("#builder-world-name").fill(worldName);
  await page.locator("#builder-save-world").click();
  await expect(page.locator("#builder-world-status")).toContainText("Saved", {
    timeout: 10_000
  });

  const savedLayoutRouteId = await page.evaluate((storageKey) => {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }

    const savedWorlds = JSON.parse(raw) as Array<{ layout?: string }>;
    const firstLayout = savedWorlds[0]?.layout;
    if (!firstLayout) {
      return null;
    }

    const parsedLayout = JSON.parse(firstLayout) as {
      metadata?: {
        cameraRoutes?: {
          defaultRouteId?: string;
        };
      };
    };
    return parsedLayout.metadata?.cameraRoutes?.defaultRouteId ?? null;
  }, SAVED_WORLDS_KEY);
  expect(savedLayoutRouteId).toBe("builder-saved-metadata-route");

  await page.locator("#builder-view-world").click();
  await expect(page.locator("#viewer-panel")).toHaveAttribute("data-viewer-load-state", "ready");
  await expect.poll(
    () =>
      cinematicEvents.find(
        (event) =>
          event.includes("viewer-cinematic:start") &&
          event.includes("source: world-metadata") &&
          event.includes("routeId: builder-saved-metadata-route")
      ),
    {
      timeout: 12_000
    }
  ).toBeTruthy();

  await page.locator("#app-edit-link").click();
  await expect(page.locator("#builder-workspace")).toBeVisible();
  await expect(page.locator("#builder-world-name")).toHaveValue(worldName);

  await page.locator("#builder-advanced-tools-toggle").click();
  await expect(page.locator("#builder-advanced-tools-panel")).toBeVisible();
  await page.locator("#builder-export").click();
  const reopenedLayout = await page.locator("#builder-layout-json").inputValue();
  const parsedReopenedLayout = JSON.parse(reopenedLayout) as {
    metadata?: {
      cameraRoutes?: {
        defaultRouteId?: string;
      };
    };
  };
  expect(parsedReopenedLayout.metadata?.cameraRoutes?.defaultRouteId).toBe("builder-saved-metadata-route");

  expect(
    pageErrors,
    "No uncaught browser page errors should occur during metadata camera route save/reopen flow."
  ).toHaveLength(0);
});
