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
const uploadCactusPath = path.join(
  process.cwd(),
  "public",
  "assets",
  "nature-kit",
  "Models",
  "GLTF format",
  "cactus_tall.glb"
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
  await page.locator("#builder-upload-asset-input").setInputFiles([uploadTreeTallPath, uploadCactusPath]);

  await expect(page.locator("#builder-status")).toContainText("Uploaded 2 assets", {
    timeout: 20_000
  });

  const uploadedAssetButton = page.locator("#builder-palette button", { hasText: "Tree Tall" });
  const uploadedCactusButton = page.locator("#builder-palette button", { hasText: "Cactus Tall" });
  await expect(uploadedAssetButton).toBeVisible();
  await expect(uploadedCactusButton).toBeVisible();
  await uploadedAssetButton.click();

  await page.locator("#builder-place-asset").click();
  await expect(page.locator("#builder-status")).toContainText("Placed", {
    timeout: 10_000
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#builder-status")).toContainText("Builder ready", {
    timeout: 20_000
  });

  const persistedAssetButton = page.locator("#builder-palette button", { hasText: "Tree Tall" });
  const persistedCactusButton = page.locator("#builder-palette button", { hasText: "Cactus Tall" });
  await expect(persistedAssetButton).toBeVisible();
  await expect(persistedCactusButton).toBeVisible();
  await persistedAssetButton.click();
  await page.locator("#builder-place-asset").click();
  await expect(page.locator("#builder-status")).toContainText("Placed", {
    timeout: 10_000
  });

  expect(pageErrors, "No uncaught browser page errors should occur during upload.").toHaveLength(0);
});
