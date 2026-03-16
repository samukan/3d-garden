import { writeFileSync } from "node:fs";

import { expect, test } from "@playwright/test";
import { strToU8, zipSync } from "fflate";

import { attachBrowserDebugListeners } from "../../browserDebugTestUtils";

function createJsonWorldFile(path: string): void {
  writeFileSync(
    path,
    JSON.stringify(
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
            defaultRouteId: "menu-json-route",
            routes: [
              {
                id: "menu-json-route",
                name: "Menu JSON Route",
                loop: false,
                timing: {
                  mode: "duration",
                  totalDurationMs: 3000
                },
                easing: "easeInOutSine",
                points: [
                  {
                    position: [14, 10, -12],
                    lookAt: [0, 2, 0],
                    dwellMs: 200
                  }
                ]
              }
            ]
          }
        }
      },
      null,
      2
    )
  );
}

function createPackageWorldFile(path: string): void {
  const exportedAt = new Date().toISOString();
  const worldPackage = {
    format: "skill-garden.world-package",
    version: 1,
    metadata: {
      worldName: "Menu Package World",
      exportedAt,
      exportedFromAppVersion: "playwright",
      objectCount: 1
    },
    layout: {
      version: 1,
      objects: [
        {
          id: "builder-object-1",
          assetId: "tree",
          position: { x: 1, y: 0, z: -1 },
          rotationY: 0,
          scale: 1
        }
      ],
      metadata: {
        cameraRoutes: {
          defaultRouteId: "menu-package-route",
          routes: [
            {
              id: "menu-package-route",
              name: "Menu Package Route",
              loop: false,
              timing: {
                mode: "duration",
                totalDurationMs: 3600
              },
              easing: "easeInOutSine",
              points: [
                {
                  position: [16, 11, -9],
                  lookAt: [0, 2, 0],
                  dwellMs: 100
                }
              ]
            }
          ]
        }
      }
    },
    assets: [
      {
        kind: "built-in",
        id: "tree",
        label: "Tree"
      }
    ]
  };

  const bytes = zipSync({
    "world.json": strToU8(JSON.stringify(worldPackage, null, 2))
  });
  writeFileSync(path, Buffer.from(bytes));
}

test("imports a .json world from menu into Build View v2", async ({ page, baseURL }, testInfo) => {
  const pageErrors = attachBrowserDebugListeners(page);
  const uploadPath = testInfo.outputPath("menu-import-builder-world.json");
  createJsonWorldFile(uploadPath);

  await page.goto(`${baseURL}/?renderer=webgl&appMode=menu&debugBrowserLogs=1`, {
    waitUntil: "domcontentloaded"
  });
  await expect(page.locator("#menu-panel")).toBeVisible();

  await page.locator("#menu-import-world-input").setInputFiles(uploadPath);
  await expect(page.locator("#menu-import-builder-confirm")).toBeVisible();
  await page.locator("#menu-import-builder-confirm").click();

  await expect(page).toHaveURL(/appMode=builder/);
  await expect(page).toHaveURL(/builderShell=v2/);
  await expect(page.locator("#builder-status")).toContainText("Imported 1 object", {
    timeout: 20_000
  });

  await page.locator("#builder-route-mode-toggle").click();
  await expect(page.locator("#builder-v2-route-select")).toBeEnabled();
  await expect(page.locator("#builder-v2-route-select option").first()).toContainText("Menu JSON Route");

  expect(pageErrors, "No uncaught browser page errors should occur when importing JSON into builder from menu.").toHaveLength(0);
});

test("imports a .sgw world package from menu into Build View v2", async ({ page, baseURL }, testInfo) => {
  const pageErrors = attachBrowserDebugListeners(page);
  const uploadPath = testInfo.outputPath("menu-import-builder-world.sgw");
  createPackageWorldFile(uploadPath);

  await page.goto(`${baseURL}/?renderer=webgl&appMode=menu&debugBrowserLogs=1`, {
    waitUntil: "domcontentloaded"
  });
  await expect(page.locator("#menu-panel")).toBeVisible();

  await page.locator("#menu-import-world-input").setInputFiles(uploadPath);
  await expect(page.locator("#menu-import-builder-confirm")).toBeVisible();
  await page.locator("#menu-import-builder-confirm").click();

  await expect(page).toHaveURL(/appMode=builder/);
  await expect(page).toHaveURL(/builderShell=v2/);
  await expect(page.locator("#builder-status")).toContainText("Imported 1 object", {
    timeout: 20_000
  });

  await page.locator("#builder-route-mode-toggle").click();
  await expect(page.locator("#builder-v2-route-select")).toBeEnabled();
  await expect(page.locator("#builder-v2-route-select option").first()).toContainText("Menu Package Route");

  expect(pageErrors, "No uncaught browser page errors should occur when importing world package into builder from menu.").toHaveLength(0);
});
