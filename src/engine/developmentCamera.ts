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
  resetOverview: (logToConsole?: boolean) => void;
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
  const camera = new ArcRotateCamera(
    "garden-camera",
    overviewFrame.alpha,
    overviewFrame.beta,
    overviewFrame.radius,
    overviewFrame.target.clone(),
    scene
  );

  camera.attachControl(false, false, 2);
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
    camera.alpha = overviewFrame.alpha;
    camera.beta = overviewFrame.beta;
    camera.radius = overviewFrame.radius;
    camera.setTarget(overviewFrame.target.clone());

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
    overviewFrame,
    resetOverview,
    dispose: () => {
      canvas.removeEventListener("contextmenu", preventContextMenu);
    }
  };
}