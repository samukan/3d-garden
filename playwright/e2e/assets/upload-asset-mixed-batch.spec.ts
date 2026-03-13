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
const invalidUploadFilePath = path.join(process.cwd(), "playwright", "fixtures", "bad-upload.txt");

test("continues multi-upload when one file is invalid", async ({ page, baseURL }) => {
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
    void dialog.accept("Mixed Batch");
  });
  await page.locator("#builder-upload-asset-input").setInputFiles([uploadFilePath, invalidUploadFilePath]);

  await expect(page.locator("#builder-status")).toContainText("1 failed", {
    timeout: 20_000
  });

  await expect(page.locator("#builder-palette button", { hasText: "Tree Tall" })).toBeVisible();
  await expect(page.locator("#builder-palette button", { hasText: "Bad Upload" })).toHaveCount(0);

  expect(pageErrors, "No uncaught browser page errors should occur during mixed uploads.").toHaveLength(0);
});
