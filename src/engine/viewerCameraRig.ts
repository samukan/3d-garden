import type { Camera } from "@babylonjs/core/Cameras/camera";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";

import { createDevelopmentCamera, type CameraOverviewFrame } from "./developmentCamera";
import { logBrowserDebug } from "../utils/browserDebug";

export type ViewerCameraMode = "presentationOrbit" | "devFree";

export interface ViewerCinematicConfig {
  preset?: "default" | "microSmallWorld";
  heroTarget: Vector3;
  heroHeight?: number;
  revealDurationMs?: number;
  settleDurationMs?: number;
  holdDurationMs?: number;
}

interface ArcRotateSnapshot {
  alpha: number;
  beta: number;
  radius: number;
  target: Vector3;
}

interface CinematicPlayback {
  preset: "default" | "microSmallWorld";
  angleInterpolation: "shortest" | "absolute";
  startedAtMs: number;
  revealDurationMs: number;
  settleDurationMs: number;
  holdDurationMs: number;
  revealEnd: ArcRotateSnapshot;
  settleEnd: ArcRotateSnapshot;
  totalDurationMs: number;
}

export interface CreateViewerCameraRigOptions {
  enableDevFreeCamera?: boolean;
}

export interface ViewerCameraRigController {
  camera: Camera;
  getMode: () => ViewerCameraMode;
  setMode: (mode: ViewerCameraMode) => ViewerCameraMode;
  toggleMode: () => ViewerCameraMode;
  canUseDevFree: () => boolean;
  setOverviewFrame: (frame: CameraOverviewFrame, applyNow?: boolean) => void;
  resetView: (logToConsole?: boolean) => void;
  startCinematic: (config: ViewerCinematicConfig) => void;
  cancelCinematic: (reason: string) => void;
  isCinematicPlaying: () => boolean;
  dispose: () => void;
}

export function createViewerCameraRig(
  scene: Scene,
  canvas: HTMLCanvasElement,
  options?: CreateViewerCameraRigOptions
): ViewerCameraRigController {
  const presentationCamera = createDevelopmentCamera(scene, canvas);
  const canUseDevFreeCamera = options?.enableDevFreeCamera === true;
  let activeMode: ViewerCameraMode = "presentationOrbit";
  let freeCamera: FreeCamera | null = null;
  let storedPresentationState: ArcRotateSnapshot | null = null;
  let cinematicPlayback: CinematicPlayback | null = null;
  let cinematicObserver: (() => void) | null = null;

  const capturePresentationState = (): ArcRotateSnapshot => ({
    alpha: presentationCamera.camera.alpha,
    beta: presentationCamera.camera.beta,
    radius: presentationCamera.camera.radius,
    target: presentationCamera.camera.target.clone()
  });

  const applyPresentationState = (state: ArcRotateSnapshot): void => {
    presentationCamera.camera.alpha = state.alpha;
    presentationCamera.camera.beta = state.beta;
    presentationCamera.camera.radius = state.radius;
    presentationCamera.camera.setTarget(state.target.clone());
  };

  const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

  const easeInOut = (value: number): number => {
    const clamped = clamp(value, 0, 1);
    return 0.5 - Math.cos(Math.PI * clamped) * 0.5;
  };

  const normalizeAngleDelta = (value: number): number => {
    let normalized = value;
    while (normalized > Math.PI) {
      normalized -= Math.PI * 2;
    }
    while (normalized < -Math.PI) {
      normalized += Math.PI * 2;
    }
    return normalized;
  };

  const lerpAngle = (
    from: number,
    to: number,
    t: number,
    interpolation: "shortest" | "absolute"
  ): number => {
    if (interpolation === "absolute") {
      return lerp(from, to, t);
    }

    return from + normalizeAngleDelta(to - from) * t;
  };

  const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;

  const interpolateSnapshot = (
    from: ArcRotateSnapshot,
    to: ArcRotateSnapshot,
    t: number,
    angleInterpolation: "shortest" | "absolute"
  ): ArcRotateSnapshot => ({
    alpha: lerpAngle(from.alpha, to.alpha, t, angleInterpolation),
    beta: lerp(from.beta, to.beta, t),
    radius: lerp(from.radius, to.radius, t),
    target: Vector3.Lerp(from.target, to.target, t)
  });

  const stopCinematic = (reason: string | null): void => {
    if (!cinematicPlayback) {
      return;
    }

    if (cinematicObserver) {
      scene.unregisterBeforeRender(cinematicObserver);
      cinematicObserver = null;
    }

    const completedPlayback = cinematicPlayback;
    cinematicPlayback = null;
    scene.activeCamera = presentationCamera.camera;
    activeMode = "presentationOrbit";
    presentationCamera.setNavigationEnabled(true);

    if (reason) {
      logBrowserDebug("viewer-cinematic:cancel", {
        reason
      });
      return;
    }

    logBrowserDebug("viewer-cinematic:complete", {
      preset: completedPlayback.preset,
      finalBeta: Number(presentationCamera.camera.beta.toFixed(3)),
      finalRadius: Number(presentationCamera.camera.radius.toFixed(3))
    });
  };

  const ensureFreeCamera = (): FreeCamera => {
    if (freeCamera) {
      return freeCamera;
    }

    const created = new FreeCamera("viewer-dev-free-camera", presentationCamera.camera.position.clone(), scene);
    created.minZ = 0.1;
    created.speed = 0.55;
    created.inertia = 0.75;
    created.angularSensibility = 3200;
    created.keysUp = [87];
    created.keysDown = [83];
    created.keysLeft = [65];
    created.keysRight = [68];
    created.setTarget(presentationCamera.camera.target.clone());
    freeCamera = created;
    return created;
  };

  const activatePresentationCamera = (): void => {
    if (storedPresentationState) {
      applyPresentationState(storedPresentationState);
      storedPresentationState = null;
    }

    if (freeCamera) {
      freeCamera.detachControl();
    }
    presentationCamera.setNavigationEnabled(true);
    scene.activeCamera = presentationCamera.camera;
    activeMode = "presentationOrbit";
  };

  const activateFreeCamera = (): void => {
    if (!canUseDevFreeCamera) {
      activatePresentationCamera();
      return;
    }

    stopCinematic("mode-switch-dev-free");

    storedPresentationState = capturePresentationState();
    const devFreeCamera = ensureFreeCamera();
    devFreeCamera.position.copyFrom(presentationCamera.camera.position);
    devFreeCamera.setTarget(presentationCamera.camera.target.clone());
    presentationCamera.setNavigationEnabled(false);
    scene.activeCamera = devFreeCamera;
    devFreeCamera.attachControl(false);
    activeMode = "devFree";
  };

  const setMode = (nextMode: ViewerCameraMode): ViewerCameraMode => {
    if (nextMode === activeMode) {
      return activeMode;
    }

    if (nextMode === "devFree") {
      activateFreeCamera();
      return activeMode;
    }

    activatePresentationCamera();
    return activeMode;
  };

  const resetView = (logToConsole = false): void => {
    stopCinematic("reset-view");

    if (activeMode === "devFree") {
      if (freeCamera) {
        freeCamera.detachControl();
      }
      scene.activeCamera = presentationCamera.camera;
      presentationCamera.setNavigationEnabled(true);
    }

    storedPresentationState = null;
    activeMode = "presentationOrbit";
    presentationCamera.resetOverview(logToConsole);
  };

  scene.activeCamera = presentationCamera.camera;
  presentationCamera.setNavigationEnabled(true);

  return {
    camera: presentationCamera.camera,
    getMode: () => activeMode,
    setMode,
    toggleMode: () => {
      const nextMode = activeMode === "presentationOrbit" ? "devFree" : "presentationOrbit";
      return setMode(nextMode);
    },
    canUseDevFree: () => canUseDevFreeCamera,
    setOverviewFrame: (frame, applyNow = false) => {
      presentationCamera.setOverviewFrame(frame, applyNow && activeMode === "presentationOrbit");
    },
    resetView,
    startCinematic: (config) => {
      stopCinematic("start-replaced");
      setMode("presentationOrbit");

      const preset = config.preset ?? "default";
      const angleInterpolation = preset === "microSmallWorld" ? "absolute" : "shortest";
      const startFrame = capturePresentationState();
      const heroHeight = Math.max(0.5, config.heroHeight ?? 4);
      const revealDurationMs = Math.max(
        0,
        config.revealDurationMs ?? (preset === "microSmallWorld" ? 4200 : 6000)
      );
      const settleDurationMs = Math.max(
        0,
        config.settleDurationMs ?? (preset === "microSmallWorld" ? 0 : 3500)
      );
      const holdDurationMs = Math.max(
        0,
        config.holdDurationMs ?? (preset === "microSmallWorld" ? 0 : 1000)
      );
      const heroYOffset = preset === "microSmallWorld"
        ? 0
        : clamp(heroHeight * 0.24, 0.8, 2.8);
      const heroTarget = new Vector3(
        config.heroTarget.x,
        config.heroTarget.y + heroYOffset,
        config.heroTarget.z
      );

      const revealAlphaDelta = preset === "microSmallWorld" ? Math.PI * 2 : Math.PI * 0.55;
      const settleAlphaDelta = preset === "microSmallWorld" ? 0 : Math.PI * 0.22;
      const revealTargetLerp = preset === "microSmallWorld" ? 1 : 0.42;
      const revealRadius = preset === "microSmallWorld"
        ? clamp(startFrame.radius * 0.35, 8, 13.5)
        : Math.max(7.5, startFrame.radius * 0.86);
      const settleRadius = preset === "microSmallWorld"
        ? revealRadius
        : Math.max(6.4, startFrame.radius * 0.72);
      const revealBeta = preset === "microSmallWorld"
        ? clamp(Math.max(startFrame.beta, 1.04), 1, 1.16)
        : clamp(startFrame.beta * 0.92, 0.35, 1.2);
      const settleBeta = preset === "microSmallWorld"
        ? revealBeta
        : clamp(startFrame.beta * 0.84, 0.3, 1.15);

      const revealEnd: ArcRotateSnapshot = {
        alpha: startFrame.alpha + revealAlphaDelta,
        beta: revealBeta,
        radius: revealRadius,
        target: Vector3.Lerp(startFrame.target, heroTarget, revealTargetLerp)
      };

      const settleEnd: ArcRotateSnapshot = {
        alpha: revealEnd.alpha + settleAlphaDelta,
        beta: settleBeta,
        radius: settleRadius,
        target: heroTarget
      };

      const totalDurationMs = revealDurationMs + settleDurationMs + holdDurationMs;
      cinematicPlayback = {
        preset,
        angleInterpolation,
        startedAtMs: performance.now(),
        revealDurationMs,
        settleDurationMs,
        holdDurationMs,
        revealEnd,
        settleEnd,
        totalDurationMs
      };

      scene.activeCamera = presentationCamera.camera;
      activeMode = "presentationOrbit";
      presentationCamera.setNavigationEnabled(false);

      logBrowserDebug("viewer-cinematic:start", {
        preset,
        revealDurationMs,
        settleDurationMs,
        holdDurationMs,
        heroHeight: Number(heroHeight.toFixed(2))
      });

      cinematicObserver = () => {
        if (!cinematicPlayback) {
          return;
        }

        const elapsedMs = performance.now() - cinematicPlayback.startedAtMs;
        if (elapsedMs < cinematicPlayback.revealDurationMs) {
          const eased = easeInOut(elapsedMs / cinematicPlayback.revealDurationMs);
          applyPresentationState(
            interpolateSnapshot(startFrame, cinematicPlayback.revealEnd, eased, cinematicPlayback.angleInterpolation)
          );
          return;
        }

        if (elapsedMs < cinematicPlayback.revealDurationMs + cinematicPlayback.settleDurationMs) {
          const settleElapsed = elapsedMs - cinematicPlayback.revealDurationMs;
          const eased = easeInOut(settleElapsed / cinematicPlayback.settleDurationMs);
          applyPresentationState(
            interpolateSnapshot(
              cinematicPlayback.revealEnd,
              cinematicPlayback.settleEnd,
              eased,
              cinematicPlayback.angleInterpolation
            )
          );
          return;
        }

        if (elapsedMs < cinematicPlayback.totalDurationMs) {
          applyPresentationState(cinematicPlayback.settleEnd);
          return;
        }

        applyPresentationState(cinematicPlayback.settleEnd);
        stopCinematic(null);
      };

      scene.registerBeforeRender(cinematicObserver);
    },
    cancelCinematic: (reason) => {
      stopCinematic(reason);
    },
    isCinematicPlaying: () => cinematicPlayback !== null,
    dispose: () => {
      stopCinematic("dispose");
      if (freeCamera) {
        freeCamera.detachControl();
        freeCamera.dispose();
        freeCamera = null;
      }
      presentationCamera.dispose();
    }
  };
}

export type { CameraOverviewFrame };
