import path from "node:path";

import { expect, test } from "@playwright/test";

import { attachBrowserDebugListeners } from "../../browserDebugTestUtils";

const UPLOAD_DB_NAME = "skill-garden.uploaded-assets.v1";
const uploadCactusPath = path.join(
  process.cwd(),
  "public",
  "assets",
  "nature-kit",
  "Models",
  "GLTF format",
  "cactus_tall.glb"
);
const uploadTreePath = path.join(
  process.cwd(),
  "public",
  "assets",
  "nature-kit",
  "Models",
  "GLTF format",
  "tree_tall.glb"
);

test("sorts uploaded assets by A-Z and date uploaded", async ({ page, baseURL }) => {
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
    void dialog.accept("Sort Test");
  });
  await page.locator("#builder-upload-asset-input").setInputFiles(uploadCactusPath);
  await expect(page.locator("#builder-status")).toContainText("Uploaded 1 asset", {
    timeout: 20_000
  });

  await page.waitForTimeout(20);

  page.once("dialog", (dialog) => {
    void dialog.accept("Sort Test");
  });
  await page.locator("#builder-upload-asset-input").setInputFiles(uploadTreePath);
  await expect(page.locator("#builder-status")).toContainText("Uploaded 1 asset", {
    timeout: 20_000
  });

  const categoryButtons = page.locator('[data-upload-category="Sort Test"] .builder-palette-item');
  await expect(categoryButtons).toHaveCount(2);
  await expect(categoryButtons.first()).toContainText("Cactus Tall");

  await page.selectOption("#builder-upload-sort", "date-uploaded");
  await expect(categoryButtons.first()).toContainText("Tree Tall");

  expect(pageErrors, "No uncaught browser page errors should occur while sorting uploads.").toHaveLength(0);
});
