import { expect, test } from "@playwright/test";

import { attachBrowserDebugListeners } from "../../browserDebugTestUtils";

test("shows a clear error when importing malformed layout json", async ({ page, baseURL }) => {
  const pageErrors = attachBrowserDebugListeners(page);

  await page.goto(`${baseURL}/?renderer=webgl&appMode=builder&debugBrowserLogs=1`, {
    waitUntil: "domcontentloaded"
  });

  await expect(page.locator("#builder-status")).toContainText("Builder ready", {
    timeout: 20_000
  });

  await page.locator("#builder-advanced-tools-toggle").click();
  await expect(page.locator("#builder-advanced-tools-panel")).toBeVisible();
  await page.locator("#builder-layout-json").fill("{ invalid json");
  await page.locator("#builder-import").click();

  await expect(page.locator("#builder-status")).toContainText("Layout JSON could not be parsed.");

  expect(pageErrors, "No uncaught browser page errors should occur during malformed import handling.").toHaveLength(0);
});
