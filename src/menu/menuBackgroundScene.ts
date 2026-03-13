import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import type { Engine } from "@babylonjs/core/Engines/engine";
import type { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import "@babylonjs/core/Helpers/sceneHelpers";
import "@babylonjs/core/Loading/loadingScreen";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import type { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture";
import { HDRCubeTexture } from "@babylonjs/core/Materials/Textures/hdrCubeTexture";
import { Scene } from "@babylonjs/core/scene";
import "@babylonjs/loaders";

import { createCameraRoutePlayer } from "../camera-routes/cameraRoutePlayer";
import { resolveCameraRoute } from "../camera-routes/cameraRouteRegistry";
import {
  MENU_BACKGROUND_ASSET_PATHS,
  MENU_BACKGROUND_ATMOSPHERE,
  MENU_BACKGROUND_CAMERA_DEFAULTS,
  MENU_BACKGROUND_LIGHTING
} from "./menuBackgroundConfig";

export interface MenuBackgroundSceneOptions {
  glbUrl?: string;
  hdrUrl?: string;
  enableSubtleMotion?: boolean;
}

export interface MenuBackgroundSceneController {
  scene: Scene;
  dispose: () => void;
}

function createMenuCamera(scene: Scene): ArcRotateCamera {
  const camera = new ArcRotateCamera(
    "menu-background-camera",
    MENU_BACKGROUND_CAMERA_DEFAULTS.alpha,
    MENU_BACKGROUND_CAMERA_DEFAULTS.beta,
    MENU_BACKGROUND_CAMERA_DEFAULTS.radius,
    MENU_BACKGROUND_CAMERA_DEFAULTS.target.clone(),
    scene
  );

  camera.lowerRadiusLimit = 12;
  camera.upperRadiusLimit = 110;
  camera.lowerBetaLimit = 0.45;
  camera.upperBetaLimit = 1.32;
  camera.wheelDeltaPercentage = 0.03;
  camera.detachControl();
  return camera;
}

function applyFallbackAtmosphere(scene: Scene): void {
  scene.clearColor = MENU_BACKGROUND_ATMOSPHERE.clearColor;
  scene.ambientColor = MENU_BACKGROUND_ATMOSPHERE.ambientColor;
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = MENU_BACKGROUND_ATMOSPHERE.fogDensity;
  scene.fogColor = MENU_BACKGROUND_ATMOSPHERE.fogColor;
  scene.imageProcessingConfiguration.exposure = MENU_BACKGROUND_ATMOSPHERE.exposure;
  scene.imageProcessingConfiguration.contrast = MENU_BACKGROUND_ATMOSPHERE.contrast;
}

function applySkybox(scene: Scene, environmentTexture: BaseTexture): void {
  const skybox = scene.createDefaultSkybox(
    environmentTexture,
    true,
    1200,
    MENU_BACKGROUND_ATMOSPHERE.skyboxLuminance,
    false
  );
  if (!skybox) {
    return;
  }

  skybox.isPickable = false;
}

async function tryLoadHdr(scene: Scene, hdrUrl: string): Promise<void> {
  try {
    const response = await fetch(hdrUrl, { method: "GET" });
    if (!response.ok) {
      console.warn("[menu-background] HDR asset missing, using fallback atmosphere.", {
        hdrUrl,
        status: response.status
      });
      return;
    }

    const texture = new HDRCubeTexture(hdrUrl, scene, 512);
    scene.environmentTexture = texture;
    scene.environmentIntensity = MENU_BACKGROUND_ATMOSPHERE.hdrEnvironmentIntensity;
    applySkybox(scene, texture);
  } catch (error) {
    console.warn("[menu-background] HDR load failed, using fallback atmosphere.", error);
  }
}

async function tryLoadGlb(scene: Scene, glbUrl: string): Promise<void> {
  try {
    const response = await fetch(glbUrl, { method: "GET" });
    if (!response.ok) {
      console.warn("[menu-background] GLB asset missing, using fallback atmosphere.", {
        glbUrl,
        status: response.status
      });
      return;
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    const isLikelyGlb = contentType.includes("model/gltf-binary") || contentType.includes("application/octet-stream");
    if (!isLikelyGlb) {
      console.warn("[menu-background] GLB asset has unexpected content type, using fallback atmosphere.", {
        glbUrl,
        contentType
      });
      return;
    }

    await SceneLoader.AppendAsync("", glbUrl, scene);
  } catch (error) {
    console.warn("[menu-background] GLB load failed, using fallback atmosphere.", error);
  }
}

export async function createMenuBackgroundScene(
  engine: Engine | WebGPUEngine,
  options: MenuBackgroundSceneOptions = {}
): Promise<MenuBackgroundSceneController> {
  const scene = new Scene(engine);
  applyFallbackAtmosphere(scene);

  const camera = createMenuCamera(scene);
  scene.activeCamera = camera;
  const cameraRoutePlayer = createCameraRoutePlayer({
    scene,
    camera
  });
  cameraRoutePlayer.setRoute(resolveCameraRoute("menu/main"));

  const hemisphericLight = new HemisphericLight("menu-hemi", new Vector3(0, 1, 0), scene);
  hemisphericLight.intensity = MENU_BACKGROUND_LIGHTING.hemispheric.intensity;
  hemisphericLight.diffuse = MENU_BACKGROUND_LIGHTING.hemispheric.diffuse;
  hemisphericLight.groundColor = MENU_BACKGROUND_LIGHTING.hemispheric.groundColor;

  const directionalLight = new DirectionalLight(
    "menu-key-light",
    MENU_BACKGROUND_LIGHTING.directional.direction,
    scene
  );
  directionalLight.position = MENU_BACKGROUND_LIGHTING.directional.position;
  directionalLight.intensity = MENU_BACKGROUND_LIGHTING.directional.intensity;
  directionalLight.diffuse = MENU_BACKGROUND_LIGHTING.directional.diffuse;

  await Promise.all([
    tryLoadHdr(scene, options.hdrUrl ?? MENU_BACKGROUND_ASSET_PATHS.hdrUrl),
    tryLoadGlb(scene, options.glbUrl ?? MENU_BACKGROUND_ASSET_PATHS.glbUrl)
  ]);

  if (options.enableSubtleMotion) {
    cameraRoutePlayer.play({ restart: true });
  } else {
    cameraRoutePlayer.stop({ resetToStart: true });
  }

  return {
    scene,
    dispose: () => {
      cameraRoutePlayer.dispose();
      scene.dispose();
    }
  };
}
