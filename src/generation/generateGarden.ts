import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";

import type { QualityMode } from "../engine/sceneState";
import type { PortfolioItem } from "../types/portfolio";
import { getBiomeThemeList } from "./biomeFactory";
import { buildProjectLayout } from "./layout";
import { buildProjectTree, createTreeAssets, disposeTreeAssets, type ProjectVisual } from "./treeFactory";

export interface GardenSelection {
  project: PortfolioItem;
  focusPoint: Vector3;
  focusRadius: number;
}

export interface GardenController {
  dispose: () => void;
  getProject: (projectId: string) => GardenSelection | null;
  getProjectIdForMesh: (mesh: AbstractMesh) => string | null;
  setHovered: (projectId: string | null) => void;
  setSelected: (projectId: string | null) => void;
}

export function generateGarden(scene: Scene, items: PortfolioItem[], quality: QualityMode): GardenController {
  const assets = createTreeAssets(scene);
  const layout = buildProjectLayout(items);
  const visuals = new Map<string, ProjectVisual>();
  const meshProjectMap = new Map<number, string>();
  const decorationRoot = new TransformNode("garden-decoration-root", scene);
  const biomePadMaterials: StandardMaterial[] = [];
  let hoveredProjectId: string | null = null;
  let selectedProjectId: string | null = null;

  const themes = getBiomeThemeList();
  for (const theme of themes) {
    const pad = MeshBuilder.CreateDisc(`biome-pad-${theme.id}`, { radius: quality === "high" ? 14 : 12, tessellation: 48 }, scene);
    pad.parent = decorationRoot;
    pad.rotation.x = Math.PI / 2;
    pad.position = new Vector3((theme.zoneIndex - (themes.length - 1) / 2) * 24, 0.05, 0);
    const material = new StandardMaterial(`biome-pad-material-${theme.id}`, scene);
    material.diffuseColor = theme.groundTint.scale(0.92);
    material.alpha = 0.72;
    material.specularColor = Color3.Black();
    pad.material = material;
    biomePadMaterials.push(material);
  }

  const decorationMaterial = new StandardMaterial("garden-decoration-material", scene);
  decorationMaterial.diffuseColor = new Color3(0.88, 0.82, 0.66);
  decorationMaterial.specularColor = Color3.Black();

  const stoneTemplate = MeshBuilder.CreatePolyhedron("stone-template", { size: 0.48, type: 1 }, scene) as Mesh;
  stoneTemplate.isVisible = false;
  stoneTemplate.setEnabled(false);
  stoneTemplate.material = decorationMaterial;

  const tuftTemplate = MeshBuilder.CreateSphere("tuft-template", { diameter: 0.42, segments: 6 }, scene) as Mesh;
  tuftTemplate.isVisible = false;
  tuftTemplate.setEnabled(false);
  tuftTemplate.material = decorationMaterial;

  const decorationCount = quality === "high" ? 34 : 14;
  for (let index = 0; index < decorationCount; index += 1) {
    const stone = stoneTemplate.createInstance(`stone-${index}`);
    stone.parent = decorationRoot;
    stone.position = new Vector3(-30 + (index % 10) * 6, 0.18, -28 + Math.floor(index / 10) * 8);
    stone.rotation = new Vector3(index * 0.13, index * 0.22, index * 0.09);
    stone.scaling = new Vector3(0.9 + (index % 3) * 0.2, 0.6 + (index % 2) * 0.2, 0.75);

    const tuft = tuftTemplate.createInstance(`tuft-${index}`);
    tuft.parent = decorationRoot;
    tuft.position = new Vector3(-26 + (index % 9) * 6.5, 0.25, -23 + Math.floor(index / 9) * 7.2);
    tuft.scaling = new Vector3(0.8 + (index % 2) * 0.45, 0.55, 0.8 + (index % 2) * 0.45);
  }

  for (const item of items) {
    const position = layout.get(item.id);
    if (!position) {
      continue;
    }

    const visual = buildProjectTree(scene, assets, item, quality, position);
    visuals.set(item.id, visual);

    for (const mesh of visual.pickMeshes) {
      meshProjectMap.set(mesh.uniqueId, item.id);
    }
  }

  const applyStates = (): void => {
    visuals.forEach((visual, projectId) => {
      if (projectId === selectedProjectId) {
        visual.setState("selected");
        return;
      }

      if (projectId === hoveredProjectId) {
        visual.setState("hovered");
        return;
      }

      visual.setState("idle");
    });
  };

  return {
    dispose: () => {
      visuals.forEach((visual) => visual.dispose());
      visuals.clear();
      stoneTemplate.dispose();
      tuftTemplate.dispose();
      decorationMaterial.dispose();
      decorationRoot.dispose();
      for (const material of biomePadMaterials) {
        material.dispose();
      }
      disposeTreeAssets(assets);
    },
    getProject: (projectId) => {
      const visual = visuals.get(projectId);
      if (!visual) {
        return null;
      }

      return {
        project: visual.project,
        focusPoint: visual.focusPoint,
        focusRadius: visual.focusRadius
      };
    },
    getProjectIdForMesh: (mesh) => meshProjectMap.get(mesh.uniqueId) ?? null,
    setHovered: (projectId) => {
      hoveredProjectId = projectId;
      applyStates();
    },
    setSelected: (projectId) => {
      selectedProjectId = projectId;
      applyStates();
    }
  };
}
