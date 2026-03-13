import { expect, test, type Page } from "@playwright/test";

import { attachBrowserDebugListeners, normalizeInlineText } from "../browserDebugTestUtils";

interface BuilderDebugState {
  attachedNodeMatchesSelectionRoot: boolean;
  cameraNavigationEnabled: boolean;
  selectedMeshBoundingBoxes: boolean[];
}

interface BuilderDebugApi {
  beginGizmoInteractionForTest: () => void;
  completeGizmoInteractionForTest: () => void;
  getState: () => BuilderDebugState;
}

interface CanvasVisualStats {
  luminanceSpread: number;
  sampleCount: number;
  uniqueColors: number;
}

async function collectCanvasVisualStats(page: Page): Promise<CanvasVisualStats | null> {
  return page.evaluate(async () => {
    const canvas = document.querySelector<HTMLCanvasElement>("#renderCanvas");
    if (!canvas) {
      return null;
    }

    const gl = (canvas.getContext("webgl2") as WebGL2RenderingContext | null)
      ?? (canvas.getContext("webgl") as WebGLRenderingContext | null);
    if (!gl) {
      return null;
    }

    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    if (width < 2 || height < 2) {
      return {
        luminanceSpread: 0,
        sampleCount: 0,
        uniqueColors: 0
      };
    }

    const sampleFrame = (): CanvasVisualStats => {
      const samplesX = 12;
      const samplesY = 8;
      const uniqueColors = new Set<string>();
      const pixel = new Uint8Array(4);
      let minLuminance = 255;
      let maxLuminance = 0;
      let sampleCount = 0;

      for (let row = 0; row < samplesY; row += 1) {
        for (let column = 0; column < samplesX; column += 1) {
          const x = Math.floor((column / (samplesX - 1)) * (width - 1));
          const y = Math.floor((row / (samplesY - 1)) * (height - 1));
          gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);

          const red = pixel[0] ?? 0;
          const green = pixel[1] ?? 0;
          const blue = pixel[2] ?? 0;
          const quantizedColor = `${red >> 4}-${green >> 4}-${blue >> 4}`;
          uniqueColors.add(quantizedColor);

          const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
          minLuminance = Math.min(minLuminance, luminance);
          maxLuminance = Math.max(maxLuminance, luminance);

          sampleCount += 1;
        }
      }

      return {
        luminanceSpread: Number((maxLuminance - minLuminance).toFixed(2)),
        sampleCount,
        uniqueColors: uniqueColors.size
      };
    };

    let best = sampleFrame();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined)));
      const next = sampleFrame();
      if (
        next.uniqueColors > best.uniqueColors
        || (next.uniqueColors === best.uniqueColors && next.luminanceSpread > best.luminanceSpread)
      ) {
        best = next;
      }
    }

    return best;
  });
}

function extractFirstObjectLayout(exportedLayout: string): {
  id: string;
  position: { x: number; y: number; z: number };
  rotationY: number;
} {
  const parsed = JSON.parse(exportedLayout) as {
    objects: Array<{
      id: string;
      position: { x: number; y: number; z: number };
      rotationY: number;
    }>;
  };

  const firstObject = parsed.objects[0];
  if (!firstObject) {
    throw new Error("Expected at least one exported object.");
  }

  return firstObject;
}

test("boots builder mode and supports basic layout actions", async ({ page, baseURL }) => {
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

  await page.goto(`${baseURL}/?renderer=webgl&appMode=builder&debugBrowserLogs=1`, {
    waitUntil: "domcontentloaded"
  });

  await expect(page.locator("#renderCanvas")).toBeVisible();
  await expect(page.locator("#builder-workspace")).toBeVisible();
  await expect(page.locator("#app-nav-actions")).toBeHidden();
  await expect(page.locator("#builder-back-to-menu")).toBeVisible();
  await expect(page.locator("#builder-camera-nav-toggle")).toBeVisible();
  await expect(page.locator("#builder-transform-mode-move")).toBeVisible();
  await expect(page.locator("#builder-transform-mode-rotate")).toBeVisible();
  await expect(page.locator("#builder-transform-mode-scale")).toBeVisible();
  await expect(page.locator("#builder-advanced-tools-toggle")).toBeVisible();
  await expect(page.locator("#builder-toggle-library-panel")).toBeVisible();
  await expect(page.locator("#builder-toggle-inspector-panel")).toBeVisible();
  const libraryPanel = page.locator("#builder-library-panel");
  const inspectorPanel = page.locator("#builder-inspector-panel");
  const resizeHandle = page.locator("#builder-resize-handle");

  await expect(libraryPanel).toBeVisible();
  await expect(page.locator("#builder-inspector-panel")).toBeVisible();
  await expect(resizeHandle).toBeVisible();
  await expect(page.locator("#builder-status")).toContainText("Builder ready", {
    timeout: 20_000
  });
  await expect(page.locator("#builder-selection-summary")).toContainText("No object selected");
  await page.locator("#renderCanvas").click();
  await page.keyboard.press("c");
  await expect(page.locator("#builder-camera-nav-toggle")).toHaveText("Camera Nav Mode");
  await page.keyboard.press("c");
  await expect(page.locator("#builder-camera-nav-toggle")).toHaveText("Object Edit Mode");
  await page.locator("#builder-transform-mode-rotate").click();
  await expect(page.locator("#builder-transform-mode-rotate")).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("3");
  await expect(page.locator("#builder-transform-mode-scale")).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("1");
  await expect(page.locator("#builder-transform-mode-move")).toHaveAttribute("aria-pressed", "true");
  await page.locator("#builder-toggle-library-panel").click();
  await expect(libraryPanel).toBeHidden();
  await page.locator("#builder-toggle-library-panel").click();
  await expect(libraryPanel).toBeVisible();
  await page.locator("#builder-toggle-inspector-panel").click();
  await expect(inspectorPanel).toBeHidden();
  await page.locator("#builder-toggle-inspector-panel").click();
  await expect(inspectorPanel).toBeVisible();

  const libraryBoundsBefore = await libraryPanel.boundingBox();
  const resizeBounds = await resizeHandle.boundingBox();
  expect(libraryBoundsBefore).not.toBeNull();
  expect(resizeBounds).not.toBeNull();

  if (!libraryBoundsBefore || !resizeBounds) {
    throw new Error("Builder resize controls did not render with measurable bounds.");
  }

  await page.mouse.move(resizeBounds.x + resizeBounds.width / 2, resizeBounds.y + resizeBounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(resizeBounds.x + resizeBounds.width / 2 + 48, resizeBounds.y + resizeBounds.height / 2);
  await page.mouse.up();

  const libraryBoundsAfter = await libraryPanel.boundingBox();
  expect(libraryBoundsAfter).not.toBeNull();

  if (!libraryBoundsAfter) {
    throw new Error("Builder library panel could not be measured after resize.");
  }

  expect(libraryBoundsAfter.width).toBeGreaterThan(libraryBoundsBefore.width + 20);

  const firstPaletteButton = page.locator("#builder-palette button").first();
  await expect(firstPaletteButton).toBeVisible();
  await firstPaletteButton.click();
  await expect(page.locator("#builder-rollout-panel")).toHaveClass(/is-visible/);
  await page.locator("#renderCanvas").click();
  await expect(page.locator("#builder-rollout-panel")).not.toHaveClass(/is-visible/);
  await firstPaletteButton.click();
  await expect(page.locator("#builder-rollout-panel")).toHaveClass(/is-visible/);
  await page.locator("#builder-place-asset").click();
  await expect(page.locator("#builder-rollout-panel")).not.toHaveClass(/is-visible/);
  await firstPaletteButton.click();
  await expect(page.locator("#builder-rollout-panel")).toHaveClass(/is-visible/);
  await page.locator("#builder-place-asset").click();

  await expect(page.locator("#builder-status")).toContainText("Placed", {
    timeout: 10_000
  });
  await expect(page.locator("#builder-selection-summary")).not.toContainText("No object selected");
  await expect(page.locator("#builder-selection-summary")).toContainText("builder-object-");
  const postPlacementVisualStats = await collectCanvasVisualStats(page);
  expect(postPlacementVisualStats).not.toBeNull();
  expect(postPlacementVisualStats?.sampleCount).toBeGreaterThan(0);
  expect(postPlacementVisualStats?.uniqueColors).toBeGreaterThan(3);
  expect(postPlacementVisualStats?.luminanceSpread).toBeGreaterThan(8);

  const selectionDebugState = await page.evaluate(() => {
    const api = (window as Window & { __skillGardenBuilderDebug?: BuilderDebugApi }).__skillGardenBuilderDebug;
    return api?.getState() ?? null;
  });
  expect(selectionDebugState).not.toBeNull();
  expect(selectionDebugState?.attachedNodeMatchesSelectionRoot).toBe(true);
  expect(selectionDebugState?.selectedMeshBoundingBoxes.every((isVisible) => isVisible)).toBe(true);

  await page.keyboard.press("c");
  await expect(page.locator("#builder-camera-nav-toggle")).toHaveText("Camera Nav Mode");
  const gizmoCameraState = await page.evaluate(() => {
    const api = (window as Window & { __skillGardenBuilderDebug?: BuilderDebugApi }).__skillGardenBuilderDebug;
    if (!api) {
      return null;
    }

    api.beginGizmoInteractionForTest();
    const during = api.getState();
    api.completeGizmoInteractionForTest();
    const after = api.getState();
    return {
      duringCameraNavigation: during.cameraNavigationEnabled,
      afterCameraNavigation: after.cameraNavigationEnabled
    };
  });
  expect(gizmoCameraState).not.toBeNull();
  expect(gizmoCameraState?.duringCameraNavigation).toBe(false);
  expect(gizmoCameraState?.afterCameraNavigation).toBe(true);
  await page.keyboard.press("c");
  await expect(page.locator("#builder-camera-nav-toggle")).toHaveText("Object Edit Mode");

  await page.locator("#builder-tab-scene").click();
  const sceneObjectRows = page.locator(".builder-scene-object-item");
  await expect(sceneObjectRows).toHaveCount(2);

  await sceneObjectRows.nth(0).click();
  await expect(page.locator("#builder-selection-summary")).toContainText("builder-object-1");

  const posXInput = page.locator("#builder-pos-x");
  const rotYInput = page.locator("#builder-rot-y");
  const posXBefore = Number(await posXInput.inputValue());
  const rotationBefore = Number(await rotYInput.inputValue());

  await page.locator("button[data-move-axis='x'][data-move-delta='0.25']").click();
  await expect(posXInput).toHaveValue((posXBefore + 0.25).toString());

  await page.locator("button[data-rotate-delta='15']").click();
  await expect(rotYInput).toHaveValue((rotationBefore + 15).toString());

  await sceneObjectRows.nth(1).click();
  await page.locator("#builder-delete-selected").click();
  await expect(sceneObjectRows).toHaveCount(1);

  await page.locator("#builder-advanced-tools-toggle").click();
  await expect(page.locator("#builder-advanced-tools-panel")).toBeVisible();
  await page.locator("#builder-export").click();

  const exportedLayout = await page.locator("#builder-layout-json").inputValue();
  expect(exportedLayout).toContain("builder-object-");
  const exportedObject = extractFirstObjectLayout(exportedLayout);
  expect(exportedObject.id).toBe("builder-object-1");
  expect(exportedObject.position.x).toBeCloseTo(posXBefore + 0.25, 5);
  expect(exportedObject.rotationY).toBeCloseTo(rotationBefore + 15, 5);

  const builderStatus = await page.locator("#builder-status").innerText();
  console.log(`[builder:ready] ${normalizeInlineText(builderStatus)}`);

  expect(shaderCompileErrors, "Builder should not emit Babylon shader compile errors in WebGL mode.").toHaveLength(0);
  expect(pageErrors, "No uncaught browser page errors should occur during builder bootstrap.").toHaveLength(0);
});
