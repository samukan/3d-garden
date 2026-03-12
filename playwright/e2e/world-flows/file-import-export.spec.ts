import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { attachBrowserDebugListeners } from "../../browserDebugTestUtils";

test("downloads and uploads world layout json files", async ({ page, baseURL }, testInfo) => {
  const pageErrors = attachBrowserDebugListeners(page);

  await page.goto(`${baseURL}/?renderer=webgl&appMode=builder&debugBrowserLogs=1`, {
    waitUntil: "domcontentloaded"
  });

  await expect(page.locator("#builder-status")).toContainText("Builder ready", {
    timeout: 20_000
  });

  await page.locator("#builder-palette button").first().click();
  await page.locator("#builder-place-asset").click();
  await expect(page.locator("#builder-status")).toContainText("Placed", {
    timeout: 10_000
  });

  await page.locator("#builder-world-name").fill("File Transfer World");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#builder-download-world-json").click()
  ]);

  const downloadPath = testInfo.outputPath("world-layout.json");
  await download.saveAs(downloadPath);

  const downloadedLayout = JSON.parse(readFileSync(downloadPath, "utf8")) as {
    objects: Array<{ id: string; assetId: string }>;
  };
  expect(downloadedLayout.objects.length).toBe(1);
  expect(downloadedLayout.objects[0]?.id).toContain("builder-object-");

  await page.locator("#builder-delete").click();
  await expect(page.locator("#builder-selection-summary")).toContainText("No object selected");

  await page.locator("#builder-upload-world-json-input").setInputFiles(downloadPath);
  await expect(page.locator("#builder-status")).toContainText("Imported 1 object", {
    timeout: 10_000
  });

  await page.locator("#builder-tab-scene").click();
  await expect(page.locator(".builder-scene-object-item")).toHaveCount(1);

  expect(pageErrors, "No uncaught browser page errors should occur during file import/export flow.").toHaveLength(0);
});
