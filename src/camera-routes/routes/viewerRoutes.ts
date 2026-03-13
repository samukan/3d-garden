import { Vector3 } from "@babylonjs/core/Maths/math.vector";

import type { CameraRouteDefinition, CameraRoutePoint } from "../cameraRouteTypes";

export type ViewerRoutePreset = "default" | "microSmallWorld";
export type ViewerRouteAngleInterpolation = "shortest" | "absolute";

export interface ViewerRouteArcSnapshot {
  alpha: number;
  beta: number;
  radius: number;
  target: Vector3;
}

export interface BuildViewerProfileRouteOptions {
  preset: ViewerRoutePreset;
  startFrame: ViewerRouteArcSnapshot;
  revealEnd: ViewerRouteArcSnapshot;
  settleEnd: ViewerRouteArcSnapshot;
  revealDurationMs: number;
  settleDurationMs: number;
  holdDurationMs: number;
  angleInterpolation: ViewerRouteAngleInterpolation;
}

interface ViewerRouteProfileConfig {
  id: string;
  name: string;
  sampleStepMs: number;
}

const VIEWER_ROUTE_PROFILE_CONFIGS: Record<ViewerRoutePreset, ViewerRouteProfileConfig> = {
  default: {
    id: "viewer-default-cinematic",
    name: "Viewer Default Cinematic",
    sampleStepMs: 260
  },
  microSmallWorld: {
    id: "viewer-micro-small-world-cinematic",
    name: "Viewer Micro Small World Cinematic",
    sampleStepMs: 180
  }
};

const TWO_PI = Math.PI * 2;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function normalizeAngleDelta(value: number): number {
  let normalized = value;
  while (normalized > Math.PI) {
    normalized -= TWO_PI;
  }
  while (normalized < -Math.PI) {
    normalized += TWO_PI;
  }
  return normalized;
}

function lerpAngle(
  from: number,
  to: number,
  t: number,
  interpolation: ViewerRouteAngleInterpolation
): number {
  if (interpolation === "absolute") {
    return lerp(from, to, t);
  }

  return from + normalizeAngleDelta(to - from) * t;
}

function interpolateArcSnapshot(
  from: ViewerRouteArcSnapshot,
  to: ViewerRouteArcSnapshot,
  t: number,
  interpolation: ViewerRouteAngleInterpolation
): ViewerRouteArcSnapshot {
  const clamped = clamp01(t);
  return {
    alpha: lerpAngle(from.alpha, to.alpha, clamped, interpolation),
    beta: lerp(from.beta, to.beta, clamped),
    radius: lerp(from.radius, to.radius, clamped),
    target: Vector3.Lerp(from.target, to.target, clamped)
  };
}

function snapshotToRoutePoint(snapshot: ViewerRouteArcSnapshot): CameraRoutePoint {
  const sinBeta = Math.sin(snapshot.beta);
  const positionX = snapshot.target.x + snapshot.radius * Math.cos(snapshot.alpha) * sinBeta;
  const positionY = snapshot.target.y + snapshot.radius * Math.cos(snapshot.beta);
  const positionZ = snapshot.target.z + snapshot.radius * Math.sin(snapshot.alpha) * sinBeta;

  return {
    position: [positionX, positionY, positionZ],
    lookAt: [snapshot.target.x, snapshot.target.y, snapshot.target.z]
  };
}

function appendSampledSegmentPoints(
  points: CameraRoutePoint[],
  from: ViewerRouteArcSnapshot,
  to: ViewerRouteArcSnapshot,
  durationMs: number,
  interpolation: ViewerRouteAngleInterpolation,
  sampleStepMs: number
): void {
  const safeDuration = Math.max(0, durationMs);
  if (safeDuration <= 0) {
    return;
  }

  const sampleCount = Math.max(1, Math.ceil(safeDuration / Math.max(1, sampleStepMs)));
  for (let index = 1; index <= sampleCount; index += 1) {
    const progress = index / sampleCount;
    points.push(snapshotToRoutePoint(interpolateArcSnapshot(from, to, progress, interpolation)));
  }
}

export function buildViewerProfileRoute({
  preset,
  startFrame,
  revealEnd,
  settleEnd,
  revealDurationMs,
  settleDurationMs,
  holdDurationMs,
  angleInterpolation
}: BuildViewerProfileRouteOptions): CameraRouteDefinition {
  const profile = VIEWER_ROUTE_PROFILE_CONFIGS[preset];
  const points: CameraRoutePoint[] = [snapshotToRoutePoint(startFrame)];

  appendSampledSegmentPoints(
    points,
    startFrame,
    revealEnd,
    revealDurationMs,
    angleInterpolation,
    profile.sampleStepMs
  );
  appendSampledSegmentPoints(
    points,
    revealEnd,
    settleEnd,
    settleDurationMs,
    angleInterpolation,
    profile.sampleStepMs
  );

  if (points.length < 2) {
    points.push(snapshotToRoutePoint(settleEnd));
  }

  const lastPoint = points[points.length - 1];
  if (lastPoint) {
    const safeHold = Math.max(0, holdDurationMs);
    if (safeHold > 0) {
      lastPoint.dwellMs = safeHold;
    }
  }

  return {
    id: profile.id,
    name: profile.name,
    loop: false,
    timing: {
      mode: "duration",
      totalDurationMs: Math.max(0, revealDurationMs + settleDurationMs)
    },
    easing: "linear",
    points
  };
}
