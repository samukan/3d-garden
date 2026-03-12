import type { ActiveRenderer } from "../engine/initEngine";

export interface StatusBarController {
  setFps: (fps: number) => void;
  setRenderer: (renderer: ActiveRenderer) => void;
}

export function createStatusBar(element: HTMLElement): StatusBarController {
  let renderer: ActiveRenderer = "WebGL";
  let fps = 0;

  const render = (): void => {
    element.innerHTML = `
      <span class="status-item"><strong>${renderer}</strong><small>Renderer</small></span>
      <span class="status-divider"></span>
      <span class="status-item"><strong>${Math.round(fps)}</strong><small>FPS</small></span>
    `;
  };

  render();

  return {
    setFps: (nextFps) => {
      fps = nextFps;
      render();
    },
    setRenderer: (nextRenderer) => {
      renderer = nextRenderer;
      render();
    }
  };
}
