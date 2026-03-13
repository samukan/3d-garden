import type { CameraRouteDefinition } from "../cameraRouteTypes";

export const MENU_MAIN_ROUTE: CameraRouteDefinition = {
  id: "menu-main-loop",
  name: "Main Menu Loop",
  loop: true,
  timing: { mode: "duration", totalDurationMs: 28000 },
  easing: "easeInOutSine",
  points: [
    {
      position: [-2.8, 24.25, -22.85],
      lookAt: [0, 5.5, 8],
      dwellMs: 900
    },
    {
      position: [-1.1, 24.35, -22.72],
      lookAt: [0, 5.5, 8]
    },
    {
      position: [1.2, 24.30, -22.62],
      lookAt: [0, 5.5, 8]
    },
    {
      position: [2.9, 24.18, -22.82],
      lookAt: [0, 5.5, 8],
      dwellMs: 900
    },
    {
      position: [1.0, 24.28, -22.66],
      lookAt: [0, 5.5, 8]
    },
    {
      position: [-2.8, 24.25, -22.85],
      lookAt: [0, 5.5, 8]
    }
  ]
};