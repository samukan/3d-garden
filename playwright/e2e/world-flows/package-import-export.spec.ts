import path from "node:path";
import { readFileSync } from "node:fs";

import { expect, test, type Browser } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";

import { attachBrowserDebugListeners } from "../../browserDebugTestUtils";

const uploadTreeTallPath = path.join(
  process.cwd(),
  "public",
  "assets",
  "nature-kit",
  "Models",
  "GLTF format",
  "tree_tall.glb"
);

async function createWorldPackage(
  browser: Browser,
  baseURL: string | undefined,
  outputPath: string
): Promise<void> {
  const buildContext = await browser.newContext();
  const buildPage = await buildContext.newPage();
  const pageErrors = attachBrowserDebugListeners(buildPage);

  await buildPage.goto(`${baseURL}/?renderer=webgl&appMode=builder&debugBrowserLogs=1`, {
    waitUntil: "domcontentloaded"
  });
  await expect(buildPage.locator("#builder-status")).toContainText("Builder ready", {
    timeout: 20_000
  });

  buildPage.once("dialog", (dialog) => {
    void dialog.accept("Portable Test");
  });
  await buildPage.locator("#builder-upload-asset-input").setInputFiles(uploadTreeTallPath);
  await expect(buildPage.locator("#builder-status")).toContainText("Uploaded 1 asset", {
    timeout: 20_000
  });

  const uploadedAssetButton = buildPage.locator('[data-upload-category="Portable Test"] button', {
    hasText: "Tree Tall"
  });
  await expect(uploadedAssetButton).toBeVisible();
  await uploadedAssetButton.click();
  await buildPage.locator("#builder-place-asset").click();
  await expect(buildPage.locator("#builder-status")).toContainText("Placed", {
    timeout: 10_000
  });

  await buildPage.locator("#builder-world-name").fill("Portable Package World");
  const advancedToolsPanel = buildPage.locator("#builder-advanced-tools-panel");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await advancedToolsPanel.isVisible()) {
      break;
    }
    await buildPage.locator("#builder-advanced-tools-toggle").click();
    await buildPage.waitForTimeout(100);
  }
  await expect(advancedToolsPanel).toBeVisible({ timeout: 10_000 });

  const [download] = await Promise.all([
    buildPage.waitForEvent("download"),
    buildPage.locator("#builder-download-world-package").click()
  ]);
  await download.saveAs(outputPath);

  expect(pageErrors, "No browser errors should occur while creating a world package.").toHaveLength(0);
  await buildContext.close();
}

function readUploadedAssetIdFromPackage(packagePath: string): string {
  const zipBytes = new Uint8Array(readFileSync(packagePath));
  const entries = unzipSync(zipBytes);
  const worldJson = entries["world.json"];
  if (!worldJson) {
    throw new Error("world.json was not found in package.");
  }

  const parsed = JSON.parse(strFromU8(worldJson)) as {
    assets?: Array<{ id: string; kind: string }>;
  };
  const uploaded = parsed.assets?.find((asset) => asset.kind === "uploaded");
  if (!uploaded?.id) {
    throw new Error("uploaded asset id was not found in package manifest.");
  }

  return uploaded.id;
}

test("imports world package with uploaded assets into a fresh builder session", async ({
  browser,
  baseURL
}, testInfo) => {
  const packagePath = testInfo.outputPath("portable-world.sgw");
  await createWorldPackage(browser, baseURL, packagePath);

  const importContext = await browser.newContext();
  const importPage = await importContext.newPage();
  const importErrors = attachBrowserDebugListeners(importPage);

  await importPage.goto(`${baseURL}/?renderer=webgl&appMode=builder&debugBrowserLogs=1`, {
    waitUntil: "domcontentloaded"
  });
  await expect(importPage.locator("#builder-status")).toContainText("Builder ready", {
    timeout: 20_000
  });

  await importPage.locator("#builder-advanced-tools-toggle").click();
  await expect(importPage.locator("#builder-advanced-tools-panel")).toBeVisible();
  await importPage.locator("#builder-upload-world-package-input").setInputFiles(packagePath);
  await expect(importPage.locator("#builder-status")).toContainText("Imported world package", {
    timeout: 20_000
  });

  await importPage.locator("#builder-tab-scene").click();
  await expect(importPage.locator(".builder-scene-object-item")).toHaveCount(1);

  expect(importErrors, "No browser errors should occur while importing world package into builder.").toHaveLength(0);
  await importContext.close();
});

test("opens world package directly from menu into viewer mode", async ({ browser, baseURL }, testInfo) => {
  const packagePath = testInfo.outputPath("menu-open-world.sgw");
  await createWorldPackage(browser, baseURL, packagePath);

  const viewerContext = await browser.newContext();
  const viewerPage = await viewerContext.newPage();
  const pageErrors = attachBrowserDebugListeners(viewerPage);

  await viewerPage.goto(`${baseURL}/?renderer=webgl&appMode=menu&debugBrowserLogs=1`, {
    waitUntil: "domcontentloaded"
  });
  await expect(viewerPage.locator("#menu-panel")).toBeVisible();

  await viewerPage.locator("#menu-open-package-input").setInputFiles(packagePath);
  await expect(viewerPage).toHaveURL(/appMode=viewer/);
  await expect(viewerPage).toHaveURL(/worldJsonId=/);
  await expect(viewerPage.locator("#viewer-panel")).toBeVisible();
  await expect(viewerPage.locator("#viewer-panel")).toHaveAttribute("data-viewer-load-state", "ready");
  await expect(viewerPage.locator("#viewer-panel")).not.toContainText("Missing asset");

  expect(pageErrors, "No browser errors should occur while opening world package from menu.").toHaveLength(0);
  await viewerContext.close();
});

test("remaps uploaded asset ids when package collides with existing local upload id", async ({
  browser,
  baseURL
}, testInfo) => {
  const packagePath = testInfo.outputPath("collision-world.sgw");
  await createWorldPackage(browser, baseURL, packagePath);
  const collidingAssetId = readUploadedAssetIdFromPackage(packagePath);

  const importContext = await browser.newContext();
  const importPage = await importContext.newPage();
  const pageErrors = attachBrowserDebugListeners(importPage);

  await importPage.addInitScript((assetId) => {
    const dbName = "skill-garden.uploaded-assets.v1";
    const storeName = "uploaded-assets";
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(storeName)) {
        database.createObjectStore(storeName, { keyPath: "id" });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const now = new Date().toISOString();
      const payload = new Uint8Array([1, 2, 3, 4]);
      const blob = new Blob([payload], { type: "model/gltf-binary" });
      store.put({
        blob,
        category: "Collision Test",
        createdAt: now,
        fileName: "collision.glb",
        fileSize: blob.size,
        id: assetId,
        label: "Collision Asset",
        mimeType: "model/gltf-binary",
        rotationY: 0,
        scale: 1,
        updatedAt: now
      });
      tx.oncomplete = () => db.close();
    };
  }, collidingAssetId);

  await importPage.goto(`${baseURL}/?renderer=webgl&appMode=builder&debugBrowserLogs=1`, {
    waitUntil: "domcontentloaded"
  });
  await expect(importPage.locator("#builder-status")).toContainText("Builder ready", {
    timeout: 20_000
  });

  await importPage.locator("#builder-advanced-tools-toggle").click();
  await expect(importPage.locator("#builder-advanced-tools-panel")).toBeVisible();
  await importPage.locator("#builder-upload-world-package-input").setInputFiles(packagePath);

  await expect(importPage.locator("#builder-status")).toContainText("Remapped 1 conflicting uploaded asset id", {
    timeout: 20_000
  });
  await importPage.locator("#builder-tab-scene").click();
  await expect(importPage.locator(".builder-scene-object-item")).toHaveCount(1);

  expect(pageErrors, "No browser errors should occur while importing package with collision remapping.").toHaveLength(0);
  await importContext.close();
});
