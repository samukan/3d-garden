import { expect, test, type Page } from "@playwright/test";

import { attachBrowserDebugListeners } from "../browserDebugTestUtils";

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
        uniqueColors.add(`${red >> 4}-${green >> 4}-${blue >> 4}`);

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
  });
}

test("places assets in WebGPU builder mode without WGSL shader-parse failures", async ({ page, baseURL }) => {
  const pageErrors = attachBrowserDebugListeners(page);
  const webGpuShaderErrors: string[] = [];

  page.on("console", (message) => {
    const text = message.text();
    if (
      text.includes("WebGPU uncaptured error") ||
      text.includes("Error while parsing WGSL") ||
      text.includes("Invalid ShaderModule") ||
      text.includes("Invalid RenderPipeline") ||
      text.includes("Invalid CommandBuffer")
    ) {
      webGpuShaderErrors.push(text);
    }
  });

  await page.goto(`${baseURL}/?renderer=webgpu&appMode=builder&debugBrowserLogs=1`, {
    waitUntil: "domcontentloaded"
  });

  await expect(page.locator("#builder-status")).toContainText("Builder ready", {
    timeout: 20_000
  });

  const rendererLabel = await page.locator("#status-badge strong").first().innerText();
  test.skip(rendererLabel.trim() !== "WebGPU", "WebGPU is unavailable in this environment.");

  const firstPaletteButton = page.locator("#builder-palette button").first();
  await expect(firstPaletteButton).toBeVisible();
  await firstPaletteButton.click();
  await page.locator("#builder-place-asset").click();

  await expect(page.locator("#builder-status")).toContainText("Placed", {
    timeout: 10_000
  });
  await expect(page.locator("#builder-selection-summary")).toContainText("builder-object-");

  const badShaderFetches = await page.evaluate(() => {
    return performance
      .getEntriesByType("resource")
      .map((entry) => (entry as PerformanceResourceTiming).name)
      .filter((name) => name.includes("/src/ShadersWGSL/") && name.endsWith(".fx"));
  });

  const canvasStats = await collectCanvasVisualStats(page);
  expect(canvasStats).not.toBeNull();
  expect(canvasStats?.sampleCount).toBeGreaterThan(0);
  expect(canvasStats?.uniqueColors).toBeGreaterThan(3);
  expect(canvasStats?.luminanceSpread).toBeGreaterThan(8);
  expect(badShaderFetches, "WebGPU should not fetch WGSL .fx shader files from /src/ShadersWGSL.").toHaveLength(0);
  expect(webGpuShaderErrors, "WebGPU shader compilation/validation warnings should not appear after placement.").toHaveLength(0);
  expect(pageErrors, "No uncaught browser page errors should occur during WebGPU builder interactions.").toHaveLength(0);
});
