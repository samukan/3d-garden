import { writeFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { attachBrowserDebugListeners } from "../../browserDebugTestUtils";

test("opens a local world layout json directly in viewer mode", async ({ page, baseURL }, testInfo) => {
  const pageErrors = attachBrowserDebugListeners(page);

  const uploadPath = testInfo.outputPath("menu-open-viewer-world.json");
  writeFileSync(
    uploadPath,
    JSON.stringify(
      {
        version: 1,
        objects: [
          {
            id: "builder-object-1",
            assetId: "tree",
            position: { x: 0, y: 0, z: 0 },
            rotationY: 0,
            scale: 1
          }
        ]
      },
      null,
      2
    )
  );

  await page.goto(`${baseURL}/?renderer=webgl&appMode=menu&debugBrowserLogs=1`, {
    waitUntil: "domcontentloaded"
  });

  await expect(page.locator("#menu-panel")).toBeVisible();
  await page.locator("#menu-open-json-input").setInputFiles(uploadPath);

  await expect(page).toHaveURL(/appMode=viewer/);
  await expect(page).toHaveURL(/worldJsonId=/);
  await expect(page.locator("#viewer-panel")).toBeVisible();
  await expect(page.locator("#viewer-panel")).toHaveAttribute("data-viewer-load-state", "ready");
  await expect(page.locator("#app-edit-link")).toBeHidden();
  await expect(page.locator("#app-title")).toContainText("menu-open-viewer-world");

  expect(pageErrors, "No uncaught browser page errors should occur when opening JSON into viewer.").toHaveLength(0);
});
