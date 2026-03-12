import { expect, test } from "@playwright/test";

import { attachBrowserDebugListeners } from "../../browserDebugTestUtils";

test("shows viewer-context error when world is missing", async ({ page, baseURL }) => {
  const pageErrors = attachBrowserDebugListeners(page);

  await page.goto(`${baseURL}/?renderer=webgl&appMode=viewer&worldId=missing-world&debugBrowserLogs=1`, {
    waitUntil: "domcontentloaded"
  });

  await expect(page.locator("#renderCanvas")).toBeVisible();
  await expect(page.locator("#app-title")).toHaveText("Viewer unavailable");
  await expect(page.locator("#viewer-panel")).toBeVisible();
  await expect(page.locator("#viewer-panel")).toHaveAttribute("data-viewer-load-state", "error");
  await expect(page.locator("#viewer-panel")).toContainText("could not be found");
  await expect(page.locator("#app-menu-link")).toBeVisible();

  expect(pageErrors, "No uncaught browser page errors should occur when viewer world is missing.").toHaveLength(0);
});
