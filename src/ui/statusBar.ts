import type { ActiveRenderer } from "../engine/initEngine";
import type { QualityMode } from "../engine/sceneState";

export interface StatusBarController {
  setFps: (fps: number) => void;
  setQuality: (quality: QualityMode) => void;
  setRenderer: (renderer: ActiveRenderer) => void;
}

export function createStatusBar(element: HTMLElement): StatusBarController {
  let renderer: ActiveRenderer = "WebGL";
  let fps = 0;
  let quality: QualityMode = "high";

  const render = (): void => {
    element.innerHTML = `
      <span><strong>Renderer</strong> ${renderer}</span>
      <span><strong>FPS</strong> ${Math.round(fps)}</span>
      <span><strong>Quality</strong> ${quality === "high" ? "High" : "Low"}</span>
    `;
  };

  render();

  return {
    setFps: (nextFps) => {
      fps = nextFps;
      render();
    },
    setQuality: (nextQuality) => {
      quality = nextQuality;
      render();
    },
    setRenderer: (nextRenderer) => {
      renderer = nextRenderer;
      render();
    }
  };
}
