import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";

export interface CameraOverviewFrame {
  alpha: number;
  beta: number;
  radius: number;
  target: Vector3;
}

export interface DevelopmentCameraController {
  camera: ArcRotateCamera;
  overviewFrame: CameraOverviewFrame;
  isNavigationEnabled: () => boolean;
  resetOverview: (logToConsole?: boolean) => void;
  setNavigationEnabled: (enabled: boolean) => void;
  setOverviewFrame: (frame: CameraOverviewFrame, applyNow?: boolean) => void;
  dispose: () => void;
}

export function createDevelopmentOverviewFrame(): CameraOverviewFrame {
  return {
    alpha: -Math.PI / 2,
    beta: 1.02,
    radius: 50,
    target: new Vector3(0, 4.8, 7.5)
  };
}

export function createDevelopmentCamera(scene: Scene, canvas: HTMLCanvasElement): DevelopmentCameraController {
  const overviewFrame = createDevelopmentOverviewFrame();
  const cloneOverviewFrame = (frame: CameraOverviewFrame): CameraOverviewFrame => ({
    alpha: frame.alpha,
    beta: frame.beta,
    radius: frame.radius,
    target: frame.target.clone()
  });
  const currentOverviewFrame = cloneOverviewFrame(overviewFrame);
  const camera = new ArcRotateCamera(
    "garden-camera",
    currentOverviewFrame.alpha,
    currentOverviewFrame.beta,
    currentOverviewFrame.radius,
    currentOverviewFrame.target.clone(),
    scene
  );

  let navigationEnabled = true;

  const applyNavigationEnabled = (): void => {
    if (navigationEnabled) {
      camera.attachControl(false, false, 2);
      return;
    }

    camera.detachControl();
  };

  applyNavigationEnabled();
  camera.lowerRadiusLimit = 2.4;
  camera.upperRadiusLimit = 110;
  camera.wheelDeltaPercentage = 0.03;
  camera.panningSensibility = 110;
  camera.panningAxis = new Vector3(1, 0, 1);
  camera.lowerBetaLimit = 0.25;
  camera.upperBetaLimit = 1.5;
  camera.minZ = 0.1;

  const preventContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };

  canvas.addEventListener("contextmenu", preventContextMenu);

  const resetOverview = (logToConsole = false): void => {
    camera.alpha = currentOverviewFrame.alpha;
    camera.beta = currentOverviewFrame.beta;
    camera.radius = currentOverviewFrame.radius;
    camera.setTarget(currentOverviewFrame.target.clone());

    if (logToConsole) {
      console.info("[dev-camera] reset overview", {
        alpha: Number(camera.alpha.toFixed(3)),
        beta: Number(camera.beta.toFixed(3)),
        radius: Number(camera.radius.toFixed(3)),
        target: {
          x: Number(camera.target.x.toFixed(3)),
          y: Number(camera.target.y.toFixed(3)),
          z: Number(camera.target.z.toFixed(3))
        }
      });
    }
  };

  return {
    camera,
    overviewFrame: currentOverviewFrame,
    isNavigationEnabled: () => navigationEnabled,
    resetOverview,
    setNavigationEnabled: (enabled) => {
      navigationEnabled = enabled;
      applyNavigationEnabled();
    },
    setOverviewFrame: (frame, applyNow = false) => {
      currentOverviewFrame.alpha = frame.alpha;
      currentOverviewFrame.beta = frame.beta;
      currentOverviewFrame.radius = frame.radius;
      currentOverviewFrame.target = frame.target.clone();
      if (applyNow) {
        resetOverview();
      }
    },
    dispose: () => {
      canvas.removeEventListener("contextmenu", preventContextMenu);
    }
  };
}
