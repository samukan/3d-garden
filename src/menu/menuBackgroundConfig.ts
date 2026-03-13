import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

export const MENU_BACKGROUND_ASSET_PATHS = {
  glbUrl: "/assets/menu/main-menu-background.glb",
  hdrUrl: "/assets/menu/main-menu-environment.hdr"
} as const;

export const MENU_BACKGROUND_CAMERA_DEFAULTS = {
  alpha: -Math.PI / 2,
  beta: 1.02,
  radius: 36,
  target: new Vector3(0, 5.5, 8)
} as const;

export const MENU_BACKGROUND_ATMOSPHERE = {
  clearColor: new Color4(0.07, 0.11, 0.16, 1),
  ambientColor: new Color3(0.2, 0.24, 0.22),
  fogColor: new Color3(0.12, 0.16, 0.2),
  fogDensity: 0.0044,
  exposure: 0.92,
  contrast: 1.04,
  hdrEnvironmentIntensity: 0.84,
  skyboxLuminance: 0.58
} as const;

export const MENU_BACKGROUND_LIGHTING = {
  hemispheric: {
    intensity: 0.84,
    diffuse: new Color3(0.96, 0.97, 0.92),
    groundColor: new Color3(0.18, 0.2, 0.18)
  },
  directional: {
    direction: new Vector3(-0.43, -1, 0.25),
    position: new Vector3(28, 34, -14),
    intensity: 0.65,
    diffuse: new Color3(1, 0.94, 0.84)
  }
} as const;