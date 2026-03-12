import path from "node:path";

import { expect, test } from "@playwright/test";

import { attachBrowserDebugListeners } from "../../browserDebugTestUtils";

const UPLOAD_DB_NAME = "skill-garden.uploaded-assets.v1";
const uploadFilePath = path.join(
  process.cwd(),
  "public",
  "assets",
  "nature-kit",
  "Models",
  "GLTF format",
  "tree_tall.glb"
);

test("uploads a GLB in builder mode", async ({ page, baseURL }) => {
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

  await page.locator("#builder-upload-asset-input").setInputFiles(uploadFilePath);

  await expect(page.locator("#builder-status")).toContainText("Uploaded", {
    timeout: 20_000
  });

  const uploadedAssetButton = page.locator("#builder-palette button", { hasText: "Tree Tall" });
  await expect(uploadedAssetButton).toBeVisible();
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
  await expect(persistedAssetButton).toBeVisible();
  await persistedAssetButton.click();
  await page.locator("#builder-place-asset").click();
  await expect(page.locator("#builder-status")).toContainText("Placed", {
    timeout: 10_000
  });

  expect(pageErrors, "No uncaught browser page errors should occur during upload.").toHaveLength(0);
});
