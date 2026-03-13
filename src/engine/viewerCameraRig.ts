import type { Camera } from "@babylonjs/core/Cameras/camera";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";

import { createDevelopmentCamera, type CameraOverviewFrame } from "./developmentCamera";

export type ViewerCameraMode = "presentationOrbit" | "devFree";

interface ArcRotateSnapshot {
  alpha: number;
  beta: number;
  radius: number;
  target: Vector3;
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
    dispose: () => {
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
