import type { Camera } from "@babylonjs/core/Cameras/camera";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";

import { createCameraRoutePlayer } from "../camera-routes/cameraRoutePlayer";
import type { CameraRouteDefinition } from "../camera-routes/cameraRouteTypes";
import { resolveViewerCinematicRoute } from "../camera-routes/cameraRouteRegistry";
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
  source: "profile" | "world-metadata";
  preset: "default" | "microSmallWorld";
  routeId: string;
  revealDurationMs: number;
  settleDurationMs: number;
  holdDurationMs: number;
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
  startRoute: (route: CameraRouteDefinition) => boolean;
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
  let handleRouteComplete: (() => void) | null = null;
  const routePlayer = createCameraRoutePlayer({
    scene,
    camera: presentationCamera.camera,
    onRouteComplete: () => {
      handleRouteComplete?.();
    }
  });
  let activeMode: ViewerCameraMode = "presentationOrbit";
  let freeCamera: FreeCamera | null = null;
  let storedPresentationState: ArcRotateSnapshot | null = null;
  let cinematicPlayback: CinematicPlayback | null = null;

  const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

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

  const stopCinematic = (reason: string | null): void => {
    if (!cinematicPlayback) {
      return;
    }

    routePlayer.stop();

    const completedPlayback = cinematicPlayback;
    cinematicPlayback = null;
    scene.activeCamera = presentationCamera.camera;
    activeMode = "presentationOrbit";
    presentationCamera.setNavigationEnabled(true);

    if (reason) {
      logBrowserDebug("viewer-cinematic:cancel", {
        reason,
        source: completedPlayback.source,
        preset: completedPlayback.preset,
        routeId: completedPlayback.routeId
      });
      return;
    }

    logBrowserDebug("viewer-cinematic:complete", {
      source: completedPlayback.source,
      preset: completedPlayback.preset,
      routeId: completedPlayback.routeId,
      finalBeta: Number(presentationCamera.camera.beta.toFixed(3)),
      finalRadius: Number(presentationCamera.camera.radius.toFixed(3))
    });
  };
  handleRouteComplete = () => {
    stopCinematic(null);
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

  const startRoutePlayback = (
    route: CameraRouteDefinition,
    playback: Omit<CinematicPlayback, "routeId">
  ): boolean => {
    stopCinematic("start-replaced");
    setMode("presentationOrbit");

    if (route.points.length < 2) {
      logBrowserDebug("viewer-cinematic:start-skipped", {
        source: playback.source,
        preset: playback.preset,
        routeId: route.id,
        routePointCount: route.points.length,
        reason: "route-too-short"
      });
      return false;
    }

    cinematicPlayback = {
      ...playback,
      routeId: route.id
    };

    scene.activeCamera = presentationCamera.camera;
    activeMode = "presentationOrbit";
    presentationCamera.setNavigationEnabled(false);

    logBrowserDebug("viewer-cinematic:start", {
      source: playback.source,
      preset: playback.preset,
      routeId: route.id,
      revealDurationMs: playback.revealDurationMs,
      settleDurationMs: playback.settleDurationMs,
      holdDurationMs: playback.holdDurationMs
    });
    logBrowserDebug("viewer-cinematic:route-resolved", {
      source: playback.source,
      preset: playback.preset,
      routeId: route.id,
      routePointCount: route.points.length,
      routeLoop: route.loop
    });

    routePlayer.setRoute(route);
    routePlayer.play({ restart: true });
    logBrowserDebug("viewer-cinematic:play-called", {
      source: playback.source,
      routeId: route.id
    });
    return routePlayer.isPlaying();
  };

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

      const cinematicRoute = resolveViewerCinematicRoute({
        preset,
        startFrame,
        revealEnd,
        settleEnd,
        revealDurationMs,
        settleDurationMs,
        holdDurationMs,
        angleInterpolation
      });

      const didStart = startRoutePlayback(cinematicRoute, {
        source: "profile",
        preset,
        revealDurationMs,
        settleDurationMs,
        holdDurationMs
      });
      if (didStart) {
        logBrowserDebug("viewer-cinematic:profile-config", {
          preset,
          heroHeight: Number(heroHeight.toFixed(2))
        });
      }
    },
    startRoute: (route) => {
      return startRoutePlayback(route, {
        source: "world-metadata",
        preset: "default",
        revealDurationMs: 0,
        settleDurationMs: 0,
        holdDurationMs: 0
      });
    },
    cancelCinematic: (reason) => {
      stopCinematic(reason);
    },
    isCinematicPlaying: () => cinematicPlayback !== null && routePlayer.isPlaying(),
    dispose: () => {
      stopCinematic("dispose");
      if (freeCamera) {
        freeCamera.detachControl();
        freeCamera.dispose();
        freeCamera = null;
      }
      routePlayer.dispose();
      presentationCamera.dispose();
    }
  };
}

export type { CameraOverviewFrame };
