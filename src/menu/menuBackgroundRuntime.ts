import type { Engine } from "@babylonjs/core/Engines/engine";
import type { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";

import { initEngine } from "../engine/initEngine";
import { createMenuBackgroundScene } from "./menuBackgroundScene";

export interface MenuBackgroundRuntimeController {
  dispose: () => void;
}

interface StartMenuBackgroundRuntimeOptions {
  canvas: HTMLCanvasElement;
  enableSubtleMotion?: boolean;
}

function createFallbackRenderer(engine: Engine | WebGPUEngine): () => void {
  return () => {
    engine.beginFrame();
    engine.clear(null, true, true, true);
    engine.endFrame();
  };
}

export async function startMenuBackgroundRuntime({
  canvas,
  enableSubtleMotion = false
}: StartMenuBackgroundRuntimeOptions): Promise<MenuBackgroundRuntimeController> {
  const { engine } = await initEngine(canvas);
  let resizeListener = (): void => {
    engine.resize();
  };
  window.addEventListener("resize", resizeListener);

  let menuSceneController = await createMenuBackgroundScene(engine, {
    enableSubtleMotion
  }).catch((error) => {
    console.warn("[menu-background] Scene bootstrap failed; using fallback background.", error);
    return null;
  });

  const renderFrame = menuSceneController
    ? () => {
        menuSceneController?.scene.render();
      }
    : createFallbackRenderer(engine);

  engine.runRenderLoop(() => {
    renderFrame();
  });

  return {
    dispose: () => {
      window.removeEventListener("resize", resizeListener);
      engine.stopRenderLoop();
      menuSceneController?.dispose();
      menuSceneController = null;
      engine.dispose();
    }
  };
}