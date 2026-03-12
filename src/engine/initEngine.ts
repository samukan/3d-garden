import { Engine } from "@babylonjs/core/Engines/engine";
import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import { logBrowserDebug } from "../utils/browserDebug";

export type ActiveRenderer = "WebGPU" | "WebGL";

type RendererPreference = "webgpu" | "webgl" | "auto";

export interface RenderingContext {
  engine: Engine | WebGPUEngine;
  renderer: ActiveRenderer;
}

function parseRendererPreference(value: string | undefined): RendererPreference {
  if (!value) {
    return "auto";
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "webgpu" || normalized === "webgl" || normalized === "auto") {
    return normalized;
  }

  return "auto";
}

function getRendererPreference(): RendererPreference {
  if (typeof window !== "undefined") {
    const rendererParam = new URLSearchParams(window.location.search).get("renderer") ?? undefined;
    const fromQuery = parseRendererPreference(rendererParam);

    if (rendererParam) {
      return fromQuery;
    }
  }

  const fromEnv = parseRendererPreference(import.meta.env.VITE_RENDERER);

  if (fromEnv !== "auto") {
    return fromEnv;
  }

  return "webgl";
}

export async function initEngine(canvas: HTMLCanvasElement): Promise<RenderingContext> {
  const rendererPreference = getRendererPreference();
  const webgpuSupported = typeof navigator !== "undefined" && "gpu" in navigator;

  logBrowserDebug("renderer:preference", {
    rendererPreference,
    webgpuSupported
  });

  if (rendererPreference !== "webgl" && webgpuSupported) {
    try {
      const isBabylonWebGpuSupported = await WebGPUEngine.IsSupportedAsync;

      if (isBabylonWebGpuSupported) {
        const webgpuEngine = new WebGPUEngine(canvas, {
          antialias: false,
          stencil: true,
          adaptToDeviceRatio: true
        });

        await webgpuEngine.initAsync();

        return {
          engine: webgpuEngine,
          renderer: "WebGPU"
        };
      }
    } catch {
      logBrowserDebug("renderer:webgpu-fallback", {
        reason: "webgpu-init-failed"
      });
      // Babylon will fall back to WebGL below if WebGPU creation or init fails.
    }
  }

  const webglEngine = new Engine(
    canvas,
    true,
    {
      preserveDrawingBuffer: false,
      stencil: true
    },
    true
  );

  return {
    engine: webglEngine,
    renderer: "WebGL"
  };
}
