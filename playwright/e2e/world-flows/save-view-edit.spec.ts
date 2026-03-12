import { expect, test } from "@playwright/test";

import { attachBrowserDebugListeners } from "../../browserDebugTestUtils";

const SAVED_WORLDS_KEY = "skill-garden.saved-worlds.v1";

test("supports save -> view -> edit roundtrip", async ({ page, baseURL }) => {
  const pageErrors = attachBrowserDebugListeners(page);

  await page.addInitScript((storageKey) => {
    const resetFlag = "__skillGardenSavedWorldsResetOnce";
    if (localStorage.getItem(resetFlag) === "1") {
      return;
    }

    localStorage.removeItem(storageKey);
    localStorage.setItem(resetFlag, "1");
  }, SAVED_WORLDS_KEY);

  await page.goto(`${baseURL}/?renderer=webgl&appMode=builder&debugBrowserLogs=1`, {
    waitUntil: "domcontentloaded"
  });

  await expect(page.locator("#builder-status")).toContainText("Builder ready", {
    timeout: 20_000
  });

  await page.locator("#builder-palette button").first().click();
  await page.locator("#builder-place-asset").click();
  await expect(page.locator("#builder-status")).toContainText("Placed");

  const worldName = `Roundtrip ${Date.now()}`;
  await page.locator("#builder-world-name").fill(worldName);
  await page.locator("#builder-save-world").click();

  await expect(page.locator("#builder-world-status")).toContainText("Saved", {
    timeout: 10_000
  });
  await expect(page.locator("#builder-view-world")).toBeEnabled();

  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });
  await page.locator("#builder-view-world").click();
  await expect(page.locator("#app-edit-link")).toBeVisible();
  await expect(page.locator("#app-title")).toHaveText(worldName);
  await expect(page.locator("#viewer-panel")).toBeVisible();
  await expect(page.locator("#viewer-panel")).toHaveAttribute("data-viewer-load-state", "ready");

  await page.locator("#app-edit-link").click();
  await expect(page.locator("#builder-workspace")).toBeVisible();
  await expect(page.locator("#builder-world-name")).toHaveValue(worldName);

  await page.locator("#builder-back-to-menu").click();
  await expect(page.locator("#menu-panel")).toBeVisible();
  await expect(page.locator(".menu-world-card", { hasText: worldName })).toBeVisible();

  expect(pageErrors, "No uncaught browser page errors should occur during save/view/edit flow.").toHaveLength(0);
});
