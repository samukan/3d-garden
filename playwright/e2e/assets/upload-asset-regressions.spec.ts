import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { attachBrowserDebugListeners } from "../../browserDebugTestUtils";

const MODIFIER_KEY = process.platform === "darwin" ? "Meta" : "Control";
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
const uploadCliffBlockPath = path.join(
  process.cwd(),
  "public",
  "assets",
  "nature-kit",
  "Models",
  "GLTF format",
  "cliff_block_stone.glb"
);

interface BuilderDebugMaterialState {
  materialDisposed: boolean;
  textureDisposed: boolean;
  texturePresent: boolean;
}

interface BuilderDebugState {
  selectedMaterialStates: BuilderDebugMaterialState[];
}

interface BuilderDebugApi {
  getState: () => BuilderDebugState;
}

async function resetUploadDatabase(page: Page): Promise<void> {
  await page.addInitScript((dbName) => {
    const resetFlag = "__skillGardenUploadDbResetOnce";
    if (localStorage.getItem(resetFlag) === "1") {
      return;
    }

    indexedDB.deleteDatabase(dbName);
    localStorage.setItem(resetFlag, "1");
  }, UPLOAD_DB_NAME);
}

async function pressUndo(page: Page): Promise<void> {
  await page.keyboard.press(`${MODIFIER_KEY}+KeyZ`);
}

async function pressRedo(page: Page): Promise<void> {
  await page.keyboard.press(`${MODIFIER_KEY}+Shift+KeyZ`);
}

async function getSelectedMaterialStates(page: Page): Promise<BuilderDebugMaterialState[]> {
  return page.evaluate(() => {
    const api = (window as Window & { __skillGardenBuilderDebug?: BuilderDebugApi }).__skillGardenBuilderDebug;
    return api?.getState().selectedMaterialStates ?? [];
  });
}

function expectMaterialResourcesHealthy(states: BuilderDebugMaterialState[], stage: string): void {
  expect(states.length, `${stage}: selected object should expose material state.`).toBeGreaterThan(0);

  for (const state of states) {
    expect(state.materialDisposed, `${stage}: material should not be disposed.`).toBe(false);
    if (state.texturePresent) {
      expect(state.textureDisposed, `${stage}: texture should not be disposed.`).toBe(false);
    }
  }
}

test("uploaded asset keeps non-disposed materials/textures after undo/redo transforms", async ({ page, baseURL }) => {
  const pageErrors = attachBrowserDebugListeners(page);
  const shaderCompileErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error") {
      return;
    }

    const text = message.text();
    if (
      text.includes("Unable to compile effect") ||
      text.includes("FRAGMENT SHADER ERROR") ||
      text.includes("Offending line")
    ) {
      shaderCompileErrors.push(text);
    }
  });
  await resetUploadDatabase(page);

  await page.goto(`${baseURL}/?renderer=webgl&appMode=builder&debugBrowserLogs=1`, {
    waitUntil: "domcontentloaded"
  });

  await expect(page.locator("#builder-status")).toContainText("Builder ready", {
    timeout: 20_000
  });

  page.once("dialog", (dialog) => {
    void dialog.accept("Undo Color Regression");
  });
  await page.locator("#builder-upload-asset-input").setInputFiles(uploadTreeTallPath);
  await expect(page.locator("#builder-status")).toContainText("Uploaded 1 asset", {
    timeout: 20_000
  });

  const uploadedTreeButton = page.locator('[data-upload-category="Undo Color Regression"] button', {
    hasText: "Tree Tall"
  });
  await expect(uploadedTreeButton).toBeVisible();
  await uploadedTreeButton.click();
  await page.locator("#builder-place-asset").click();
  await expect(page.locator("#builder-status")).toContainText("Placed", {
    timeout: 10_000
  });

  await page.locator("button[data-move-axis='x'][data-move-delta='0.25']").click();
  await expect(page.locator("#builder-status")).toContainText("Updated", {
    timeout: 10_000
  });

  const beforeUndoStates = await getSelectedMaterialStates(page);
  expectMaterialResourcesHealthy(beforeUndoStates, "Before undo");

  await pressUndo(page);
  await expect(page.locator("#builder-status")).toContainText("Undo complete.", {
    timeout: 10_000
  });
  const afterUndoStates = await getSelectedMaterialStates(page);
  expectMaterialResourcesHealthy(afterUndoStates, "After undo");

  await pressRedo(page);
  await expect(page.locator("#builder-status")).toContainText("Redo complete.", {
    timeout: 10_000
  });
  const afterRedoStates = await getSelectedMaterialStates(page);
  expectMaterialResourcesHealthy(afterRedoStates, "After redo");

  expect(shaderCompileErrors, "Uploaded assets should not trigger shader compile errors in WebGL mode.").toHaveLength(0);
  expect(pageErrors, "No uncaught browser page errors should occur during undo/redo material checks.").toHaveLength(0);
});

test("removes only the selected uploaded asset without clearing the whole upload library", async ({ page, baseURL }) => {
  const pageErrors = attachBrowserDebugListeners(page);
  await resetUploadDatabase(page);

  await page.goto(`${baseURL}/?renderer=webgl&appMode=builder&debugBrowserLogs=1`, {
    waitUntil: "domcontentloaded"
  });

  await expect(page.locator("#builder-status")).toContainText("Builder ready", {
    timeout: 20_000
  });

  page.once("dialog", (dialog) => {
    void dialog.accept("Single Remove");
  });
  await page.locator("#builder-upload-asset-input").setInputFiles([uploadTreeTallPath, uploadCliffBlockPath]);
  await expect(page.locator("#builder-status")).toContainText("Uploaded 2 assets", {
    timeout: 20_000
  });

  const treeButton = page.locator('[data-upload-category="Single Remove"] button', {
    hasText: "Tree Tall"
  });
  const cliffButton = page.locator('[data-upload-category="Single Remove"] button', {
    hasText: "Cliff Block Stone"
  });
  await expect(treeButton).toBeVisible();
  await expect(cliffButton).toBeVisible();

  await treeButton.click();
  await page.locator("#builder-place-asset").click();
  await expect(page.locator("#builder-status")).toContainText("Placed", {
    timeout: 10_000
  });

  await cliffButton.click();
  await page.locator("#builder-place-asset").click();
  await expect(page.locator("#builder-status")).toContainText("Placed", {
    timeout: 10_000
  });

  await page.locator("#builder-tab-scene").click();
  const sceneObjectRows = page.locator(".builder-scene-object-item");
  await expect(sceneObjectRows).toHaveCount(2);

  await page.locator("#builder-tab-assets").click();
  await treeButton.click();
  page.once("dialog", (dialog) => {
    void dialog.accept();
  });
  await page.locator("#builder-remove-upload").click();

  await expect(page.locator("#builder-status")).toContainText("Removed uploaded asset Tree Tall.", {
    timeout: 10_000
  });
  await expect(treeButton).toHaveCount(0);
  await expect(cliffButton).toBeVisible();

  await page.locator("#builder-tab-scene").click();
  await expect(sceneObjectRows).toHaveCount(1);
  await expect(sceneObjectRows.first()).toContainText("Cliff Block Stone");

  expect(pageErrors, "No uncaught browser page errors should occur while removing one uploaded asset.").toHaveLength(0);
});
