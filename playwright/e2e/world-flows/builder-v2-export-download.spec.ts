import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";

import { attachBrowserDebugListeners } from "../../browserDebugTestUtils";

test("v2 exports current edits as .json and .sgw with camera route metadata", async ({ page, baseURL }, testInfo) => {
  const pageErrors = attachBrowserDebugListeners(page);
  const openOverflowMenu = async (): Promise<void> => {
    await page.locator("#builder-toolbar-overflow-toggle").evaluate((button) => {
      button.click();
    });
  };

  await page.goto(`${baseURL}/?renderer=webgl&appMode=builder&builderShell=v2&debugBrowserLogs=1`, {
    waitUntil: "domcontentloaded"
  });

  await expect(page.locator("#builder-status")).toContainText("Builder ready", {
    timeout: 20_000
  });

  await page.locator("#builder-palette .builder-palette-item").first().click();
  await page.locator("#builder-place-asset").click();
  await expect(page.locator("#builder-status")).toContainText("Placed", {
    timeout: 10_000
  });

  await page.locator("#builder-route-mode-toggle").click();
  await expect(page.locator("#builder-route-mode-toggle")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#builder-inspector-tab-route")).toHaveAttribute("aria-selected", "true");

  await page.locator("#builder-v2-route-create").click();
  await expect(page.locator("#builder-v2-route-select")).toBeEnabled();
  await page.locator("#builder-v2-route-add-point").click();
  await expect(page.locator(".builder-route-point-item")).toHaveCount(1);

  await page.locator("#builder-world-name").fill("V2 Export Route World");

  await openOverflowMenu();
  await expect(page.locator("#builder-toolbar-download-world-json")).toBeVisible();
  const [jsonDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#builder-toolbar-download-world-json").click()
  ]);
  const jsonPath = testInfo.outputPath("v2-export-world.json");
  await jsonDownload.saveAs(jsonPath);

  const parsedLayout = JSON.parse(readFileSync(jsonPath, "utf8")) as {
    metadata?: {
      cameraRoutes?: {
        routes?: Array<{ id?: string; points?: unknown[] }>;
      };
    };
    objects?: unknown[];
  };

  expect(parsedLayout.objects?.length ?? 0).toBeGreaterThan(0);
  expect(parsedLayout.metadata?.cameraRoutes?.routes?.length ?? 0).toBeGreaterThan(0);
  expect(parsedLayout.metadata?.cameraRoutes?.routes?.[0]?.id).toBeTruthy();
  expect(parsedLayout.metadata?.cameraRoutes?.routes?.[0]?.points?.length ?? 0).toBeGreaterThan(0);

  await openOverflowMenu();
  await expect(page.locator("#builder-toolbar-download-world-package")).toBeVisible();
  const [packageDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#builder-toolbar-download-world-package").click()
  ]);
  const packagePath = testInfo.outputPath("v2-export-world.sgw");
  await packageDownload.saveAs(packagePath);

  const packageEntries = unzipSync(new Uint8Array(readFileSync(packagePath)));
  const worldManifestJson = packageEntries["world.json"];
  expect(worldManifestJson, "Expected world.json to be present in exported .sgw package.").toBeTruthy();

  const parsedPackage = JSON.parse(strFromU8(worldManifestJson!)) as {
    layout?: {
      metadata?: {
        cameraRoutes?: {
          routes?: Array<{ id?: string; points?: unknown[] }>;
        };
      };
      objects?: unknown[];
    };
  };

  expect(parsedPackage.layout?.objects?.length ?? 0).toBeGreaterThan(0);
  expect(parsedPackage.layout?.metadata?.cameraRoutes?.routes?.length ?? 0).toBeGreaterThan(0);
  expect(parsedPackage.layout?.metadata?.cameraRoutes?.routes?.[0]?.id).toBeTruthy();
  expect(parsedPackage.layout?.metadata?.cameraRoutes?.routes?.[0]?.points?.length ?? 0).toBeGreaterThan(0);

  expect(
    pageErrors,
    "No uncaught browser page errors should occur during v2 world export/download flow."
  ).toHaveLength(0);
});
