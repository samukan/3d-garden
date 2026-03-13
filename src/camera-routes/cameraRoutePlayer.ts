import type { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";

import {
  easeRouteProgress,
  lerpVector3ToRef,
  tupleToVector3
} from "./cameraRouteMath";
import type {
  CameraRouteDefinition,
  CameraRouteEasing,
  CameraRoutePlayOptions,
  CameraRouteStopOptions
} from "./cameraRouteTypes";

interface CameraRouteCompiledPoint {
  position: Vector3;
  lookAt: Vector3;
  dwellMs: number;
}

interface CameraRouteCompiledState {
  definition: CameraRouteDefinition;
  easing: CameraRouteEasing;
  points: CameraRouteCompiledPoint[];
  segmentDurationsMs: number[];
}

type PlaybackPhase = "dwell" | "move";

export interface CreateCameraRoutePlayerOptions {
  scene: Scene;
  camera: ArcRotateCamera;
  onRouteComplete?: () => void;
}

export interface CameraRoutePlayerController {
  setRoute: (route: CameraRouteDefinition | null) => void;
  play: (options?: CameraRoutePlayOptions) => void;
  pause: () => void;
  stop: (options?: CameraRouteStopOptions) => void;
  resetToStart: () => void;
  isPlaying: () => boolean;
  dispose: () => void;
}

function sanitizeNonNegative(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, value ?? 0);
}

function buildSegmentDurationsMs(
  route: CameraRouteDefinition,
  points: CameraRouteCompiledPoint[]
): number[] {
  const segmentCount = Math.max(0, points.length - 1);
  if (segmentCount === 0) {
    return [];
  }

  const segmentDistances: number[] = [];
  let totalDistance = 0;
  for (let index = 0; index < segmentCount; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    if (!from || !to) {
      continue;
    }

    const distance = Vector3.Distance(from.position, to.position);
    segmentDistances.push(distance);
    totalDistance += distance;
  }

  if (route.timing.mode === "speed") {
    const unitsPerSecond = Math.max(0.001, sanitizeNonNegative(route.timing.unitsPerSecond));
    return segmentDistances.map((distance) => (distance / unitsPerSecond) * 1000);
  }

  const totalDurationMs = sanitizeNonNegative(route.timing.totalDurationMs);
  if (totalDurationMs <= 0) {
    return segmentDistances.map(() => 0);
  }

  if (totalDistance <= 0.00001) {
    const evenDuration = totalDurationMs / segmentDistances.length;
    return segmentDistances.map(() => evenDuration);
  }

  return segmentDistances.map((distance) => (distance / totalDistance) * totalDurationMs);
}

function compileRoute(route: CameraRouteDefinition): CameraRouteCompiledState | null {
  if (route.points.length === 0) {
    return null;
  }

  const points = route.points.map((point) => ({
    position: tupleToVector3(point.position),
    lookAt: tupleToVector3(point.lookAt),
    dwellMs: sanitizeNonNegative(point.dwellMs)
  }));

  return {
    definition: route,
    easing: route.easing ?? "easeInOutSine",
    points,
    segmentDurationsMs: buildSegmentDurationsMs(route, points)
  };
}

export function createCameraRoutePlayer({
  scene,
  camera,
  onRouteComplete
}: CreateCameraRoutePlayerOptions): CameraRoutePlayerController {
  let compiledRoute: CameraRouteCompiledState | null = null;
  let renderObserver: (() => void) | null = null;
  let playing = false;
  let completed = false;
  let phase: PlaybackPhase = "dwell";
  let currentPointIndex = 0;
  let moveElapsedMs = 0;
  let dwellRemainingMs = 0;
  let lastTickMs = 0;

  const interpolatedPosition = new Vector3();
  const interpolatedLookAt = new Vector3();

  const unregisterObserver = (): void => {
    if (!renderObserver) {
      return;
    }

    scene.unregisterBeforeRender(renderObserver);
    renderObserver = null;
  };

  const pauseInternal = (): void => {
    playing = false;
    unregisterObserver();
  };

  const applyPose = (position: Vector3, lookAt: Vector3): void => {
    camera.setPosition(position);
    camera.setTarget(lookAt);
  };

  const applyPoint = (index: number): void => {
    if (!compiledRoute) {
      return;
    }

    const point = compiledRoute.points[index];
    if (!point) {
      return;
    }

    applyPose(point.position, point.lookAt);
  };

  const resetState = (): void => {
    currentPointIndex = 0;
    moveElapsedMs = 0;
    completed = false;

    if (!compiledRoute || compiledRoute.points.length === 0) {
      phase = "dwell";
      dwellRemainingMs = 0;
      return;
    }

    applyPoint(0);
    dwellRemainingMs = compiledRoute.points[0]?.dwellMs ?? 0;
    phase = dwellRemainingMs > 0 ? "dwell" : "move";
  };

  const transitionFromDwell = (): void => {
    if (!compiledRoute || compiledRoute.points.length === 0) {
      return;
    }

    const lastPointIndex = compiledRoute.points.length - 1;
    if (currentPointIndex >= lastPointIndex) {
      if (compiledRoute.definition.loop && compiledRoute.points.length > 1) {
        currentPointIndex = 0;
        moveElapsedMs = 0;
        applyPoint(0);
        dwellRemainingMs = compiledRoute.points[0]?.dwellMs ?? 0;
        phase = dwellRemainingMs > 0 ? "dwell" : "move";
        return;
      }

      completed = true;
      pauseInternal();
      onRouteComplete?.();
      return;
    }

    moveElapsedMs = 0;
    phase = "move";
  };

  const completeMoveSegment = (): void => {
    if (!compiledRoute) {
      return;
    }

    currentPointIndex += 1;
    applyPoint(currentPointIndex);
    moveElapsedMs = 0;
    dwellRemainingMs = compiledRoute.points[currentPointIndex]?.dwellMs ?? 0;
    phase = "dwell";
  };

  const applyInterpolatedSegmentPose = (segmentIndex: number, progress: number): void => {
    if (!compiledRoute) {
      return;
    }

    const from = compiledRoute.points[segmentIndex];
    const to = compiledRoute.points[segmentIndex + 1];
    if (!from || !to) {
      return;
    }

    lerpVector3ToRef(from.position, to.position, progress, interpolatedPosition);
    lerpVector3ToRef(from.lookAt, to.lookAt, progress, interpolatedLookAt);
    applyPose(interpolatedPosition, interpolatedLookAt);
  };

  const stepPlayback = (deltaMs: number): void => {
    if (!playing || !compiledRoute) {
      return;
    }

    let remainingMs = Math.max(0, deltaMs);
    let guard = 0;

    while (remainingMs > 0.0001 && guard < 64 && playing) {
      guard += 1;

      if (phase === "dwell") {
        if (dwellRemainingMs > 0) {
          const consumed = Math.min(remainingMs, dwellRemainingMs);
          dwellRemainingMs -= consumed;
          remainingMs -= consumed;
        }

        if (dwellRemainingMs <= 0) {
          transitionFromDwell();
        }
        continue;
      }

      const segmentDurationMs = compiledRoute.segmentDurationsMs[currentPointIndex] ?? 0;
      if (segmentDurationMs <= 0) {
        completeMoveSegment();
        continue;
      }

      const remainingInSegmentMs = Math.max(0, segmentDurationMs - moveElapsedMs);
      const consumed = Math.min(remainingMs, remainingInSegmentMs);
      moveElapsedMs += consumed;
      remainingMs -= consumed;

      const easedProgress = easeRouteProgress(
        moveElapsedMs / segmentDurationMs,
        compiledRoute.easing
      );
      applyInterpolatedSegmentPose(currentPointIndex, easedProgress);

      if (moveElapsedMs >= segmentDurationMs - 0.0001) {
        completeMoveSegment();
      }
    }
  };

  const registerObserver = (): void => {
    if (renderObserver) {
      return;
    }

    renderObserver = () => {
      if (!playing) {
        return;
      }

      const now = performance.now();
      const deltaMs = lastTickMs > 0 ? now - lastTickMs : 0;
      lastTickMs = now;
      stepPlayback(deltaMs);
    };

    scene.registerBeforeRender(renderObserver);
  };

  return {
    setRoute: (route) => {
      pauseInternal();
      compiledRoute = route ? compileRoute(route) : null;
      resetState();
    },
    play: (options = {}) => {
      if (!compiledRoute || compiledRoute.points.length < 2) {
        return;
      }

      if (options.restart || completed) {
        resetState();
      }

      if (completed) {
        return;
      }

      playing = true;
      lastTickMs = performance.now();
      registerObserver();
    },
    pause: () => {
      pauseInternal();
    },
    stop: (options = {}) => {
      pauseInternal();
      if (options.resetToStart) {
        resetState();
      }
    },
    resetToStart: () => {
      resetState();
    },
    isPlaying: () => playing,
    dispose: () => {
      pauseInternal();
      compiledRoute = null;
    }
  };
}
