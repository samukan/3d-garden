import path from "node:path";

import { expect, test } from "@playwright/test";

import { attachBrowserDebugListeners } from "../../browserDebugTestUtils";

const UPLOAD_DB_NAME = "skill-garden.uploaded-assets.v1";
const uploadTreeTallPath = path.join(
  process.cwd(),
  "public",
  "assets",
  "nature-kit",
  "Models",
  "GLTF format",
  "tree_tall.glb"
);
const uploadCliffBlockPath = path.join(
  process.cwd(),
  "public",
  "assets",
  "nature-kit",
  "Models",
  "GLTF format",
  "cliff_block_stone.glb"
);

test("uploads multiple GLBs in builder mode", async ({ page, baseURL }) => {
  const pageErrors = attachBrowserDebugListeners(page);

  await page.addInitScript((dbName) => {
    const resetFlag = "__skillGardenUploadDbResetOnce";
    if (localStorage.getItem(resetFlag) === "1") {
      return;
    }

    indexedDB.deleteDatabase(dbName);
    localStorage.setItem(resetFlag, "1");
  }, UPLOAD_DB_NAME);

  await page.goto(`${baseURL}/?renderer=webgl&appMode=builder&debugBrowserLogs=1`, {
    waitUntil: "domcontentloaded"
  });

  await expect(page.locator("#builder-status")).toContainText("Builder ready", {
    timeout: 20_000
  });

  page.once("dialog", (dialog) => {
    void dialog.accept("Batch Trees");
  });
  await page.locator("#builder-upload-asset-input").setInputFiles([uploadTreeTallPath, uploadCliffBlockPath]);

  await expect(page.locator("#builder-status")).toContainText("Uploaded 2 assets", {
    timeout: 20_000
  });

  const uploadedAssetButton = page.locator('[data-upload-category="Batch Trees"] button', { hasText: "Tree Tall" });
  const uploadedCliffButton = page.locator('[data-upload-category="Batch Trees"] button', {
    hasText: "Cliff Block Stone"
  });
  await expect(uploadedAssetButton).toBeVisible();
  await expect(uploadedCliffButton).toBeVisible();
  await uploadedAssetButton.click();

  await page.locator("#builder-place-asset").click();
  await expect(page.locator("#builder-status")).toContainText("Placed", {
    timeout: 10_000
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#builder-status")).toContainText("Builder ready", {
    timeout: 20_000
  });

  const persistedAssetButton = page.locator('[data-upload-category="Batch Trees"] button', { hasText: "Tree Tall" });
  const persistedCliffButton = page.locator('[data-upload-category="Batch Trees"] button', {
    hasText: "Cliff Block Stone"
  });
  await expect(persistedAssetButton).toBeVisible();
  await expect(persistedCliffButton).toBeVisible();
  await persistedAssetButton.click();
  await page.locator("#builder-place-asset").click();
  await expect(page.locator("#builder-status")).toContainText("Placed", {
    timeout: 10_000
  });

  expect(pageErrors, "No uncaught browser page errors should occur during upload.").toHaveLength(0);
});
