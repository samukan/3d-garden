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

test("categorizes uploaded assets and persists category rename", async ({ page, baseURL }) => {
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
    void dialog.accept("Seasonal Trees");
  });
  await page.locator("#builder-upload-asset-input").setInputFiles(uploadFilePath);

  await expect(page.locator('[data-upload-category="Seasonal Trees"]')).toBeVisible({
    timeout: 20_000
  });
  await page.locator("#builder-palette button", { hasText: "Tree Tall" }).click();

  page.once("dialog", (dialog) => {
    void dialog.accept("Evergreens");
  });
  await page.locator("#builder-rename-upload-category").click();

  await expect(page.locator('[data-upload-category="Evergreens"]')).toBeVisible();
  await expect(page.locator('[data-upload-category="Seasonal Trees"]')).toHaveCount(0);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#builder-status")).toContainText("Builder ready", {
    timeout: 20_000
  });
  await expect(page.locator('[data-upload-category="Evergreens"]')).toBeVisible();
  await expect(page.locator('[data-upload-category="Evergreens"] button', { hasText: "Tree Tall" })).toBeVisible();

  expect(pageErrors, "No uncaught browser page errors should occur during category management.").toHaveLength(0);
});
