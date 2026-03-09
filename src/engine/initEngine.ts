import { Engine } from "@babylonjs/core/Engines/engine";
import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";

export type ActiveRenderer = "WebGPU" | "WebGL";

export interface RenderingContext {
  engine: Engine | WebGPUEngine;
  renderer: ActiveRenderer;
}

export async function initEngine(canvas: HTMLCanvasElement): Promise<RenderingContext> {
  const webgpuSupported = typeof navigator !== "undefined" && "gpu" in navigator;

  if (webgpuSupported) {
    try {
      const isBabylonWebGpuSupported = await WebGPUEngine.IsSupportedAsync;

      if (isBabylonWebGpuSupported) {
        const webgpuEngine = new WebGPUEngine(canvas, {
          antialias: true,
          adaptToDeviceRatio: true
        });

        await webgpuEngine.initAsync();

        return {
          engine: webgpuEngine,
          renderer: "WebGPU"
        };
      }
    } catch {
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
