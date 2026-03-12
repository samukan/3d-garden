import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Engine } from "@babylonjs/core/Engines/engine";
import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Scalar } from "@babylonjs/core/Maths/math.scalar";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Scene } from "@babylonjs/core/scene";

import { generateGarden } from "../generation/generateGarden";
import type { PortfolioItem } from "../types/portfolio";
import { createSceneState, type QualityMode } from "./sceneState";

interface CreateSceneOptions {
  canvas: HTMLCanvasElement;
  engine: Engine | WebGPUEngine;
  items: PortfolioItem[];
  initialQuality: QualityMode;
  onProjectSelected: (project: PortfolioItem | null) => void;
}

export interface SceneController {
  scene: Scene;
  setQuality: (quality: QualityMode) => void;
}

export async function createScene({
  canvas,
  engine,
  items,
  initialQuality,
  onProjectSelected
}: CreateSceneOptions): Promise<SceneController> {
  const scene = new Scene(engine);
  const state = createSceneState(initialQuality);

  scene.clearColor = new Color4(0.75, 0.86, 0.9, 1);
  scene.ambientColor = new Color3(0.18, 0.22, 0.21);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.0074;
  scene.fogColor = new Color3(0.84, 0.89, 0.86);

  const defaultTarget = new Vector3(0, 4.8, 7.5);
  const camera = new ArcRotateCamera("garden-camera", -Math.PI / 2, 1.02, 50, defaultTarget.clone(), scene);
  camera.attachControl(canvas, true);
  camera.lowerRadiusLimit = 15;
  camera.upperRadiusLimit = 72;
  camera.wheelDeltaPercentage = 0.01;
  camera.panningSensibility = 0;
  camera.lowerBetaLimit = 0.58;
  camera.upperBetaLimit = 1.16;

  const hemiLight = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
  hemiLight.intensity = 0.9;
  hemiLight.diffuse = new Color3(0.92, 0.95, 0.89);
  hemiLight.groundColor = new Color3(0.15, 0.18, 0.16);

  const sunLight = new DirectionalLight("sun", new Vector3(-0.35, -1, 0.2), scene);
  sunLight.position = new Vector3(30, 36, -16);
  sunLight.intensity = 0.92;
  sunLight.diffuse = new Color3(1, 0.95, 0.84);

  const ground = MeshBuilder.CreateGround("ground", { width: 128, height: 112, subdivisions: 2 }, scene);
  const groundMaterial = new StandardMaterial("ground-material", scene);
  groundMaterial.diffuseColor = new Color3(0.32, 0.41, 0.29);
  groundMaterial.emissiveColor = new Color3(0.018, 0.024, 0.018);
  groundMaterial.specularColor = Color3.Black();
  ground.material = groundMaterial;
  ground.receiveShadows = true;

  let garden = generateGarden(scene, items, state.quality);

  const updateSelection = (projectId: string | null): void => {
    state.selectedProjectId = projectId;
    garden.setSelected(projectId);

    if (!projectId) {
      state.desiredCameraTarget = defaultTarget.clone();
      state.desiredCameraRadius = 50;
      onProjectSelected(null);
      return;
    }

    const selection = garden.getProject(projectId);
    if (!selection) {
      onProjectSelected(null);
      return;
    }

    state.desiredCameraTarget = selection.focusPoint.clone();
    state.desiredCameraRadius = selection.focusRadius;
    onProjectSelected(selection.project);
  };

  scene.onPointerObservable.add((pointerInfo) => {
    const pickedMesh = pointerInfo.pickInfo?.pickedMesh ?? null;
    const pickedProjectId = pickedMesh ? garden.getProjectIdForMesh(pickedMesh) : null;

    if (pointerInfo.type === PointerEventTypes.POINTERMOVE) {
      if (state.hoveredProjectId !== pickedProjectId) {
        state.hoveredProjectId = pickedProjectId;
        garden.setHovered(pickedProjectId);
      }

      return;
    }

    if (pointerInfo.type === PointerEventTypes.POINTERPICK) {
      updateSelection(pickedProjectId);
    }
  });

  scene.onBeforeRenderObservable.add(() => {
    const blend = Math.min(engine.getDeltaTime() * 0.004, 1);
    camera.setTarget(Vector3.Lerp(camera.target, state.desiredCameraTarget, blend));
    camera.radius = Scalar.Lerp(camera.radius, state.desiredCameraRadius, blend);
  });

  return {
    scene,
    setQuality: (quality) => {
      if (quality === state.quality) {
        return;
      }

      state.quality = quality;
      state.hoveredProjectId = null;
      state.selectedProjectId = null;

      garden.dispose();
      garden = generateGarden(scene, items, quality);
      updateSelection(null);
    }
  };
}
