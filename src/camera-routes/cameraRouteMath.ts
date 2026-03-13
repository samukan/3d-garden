import { Vector3 } from "@babylonjs/core/Maths/math.vector";

import type { CameraRouteEasing, CameraRoutePointVector } from "./cameraRouteTypes";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

export function easeRouteProgress(progress: number, easing: CameraRouteEasing): number {
  const clamped = clamp01(progress);
  if (easing === "linear") {
    return clamped;
  }

  return 0.5 - Math.cos(Math.PI * clamped) * 0.5;
}

export function tupleToVector3(value: CameraRoutePointVector): Vector3 {
  return new Vector3(value[0], value[1], value[2]);
}

export function lerpVector3ToRef(from: Vector3, to: Vector3, t: number, result: Vector3): void {
  result.x = lerp(from.x, to.x, t);
  result.y = lerp(from.y, to.y, t);
  result.z = lerp(from.z, to.z, t);
}
