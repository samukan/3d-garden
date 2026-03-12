import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";

import type { QualityMode } from "../engine/sceneState";
import type { PortfolioItem } from "../types/portfolio";
import { createBiomeAnchors } from "./biomeAnchorFactory";
import { createGroundComposition } from "./groundFactory";
import { getBiomeThemeList } from "./biomeFactory";
import { buildProjectLayout, getZoneCenters } from "./layout";
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
  const zoneCenters = getZoneCenters();
  const visuals = new Map<string, ProjectVisual>();
  const meshProjectMap = new Map<number, string>();
  const decorationRoot = new TransformNode("garden-decoration-root", scene);
  let hoveredProjectId: string | null = null;
  let selectedProjectId: string | null = null;

  const themes = getBiomeThemeList();
  const groundComposition = createGroundComposition(scene, themes, quality, zoneCenters);
  const biomeAnchors = createBiomeAnchors(scene, themes, quality, zoneCenters);

  const clearingMaterial = new StandardMaterial("clearing-column-material", scene);
  clearingMaterial.diffuseColor = new Color3(0.58, 0.54, 0.44);
  clearingMaterial.emissiveColor = new Color3(0.03, 0.028, 0.02);
  clearingMaterial.specularColor = Color3.Black();

  const clearingColumns: TransformNode[] = [];
  const columnOffsets = [-4.6, -1.4, 1.4, 4.6];
  for (const offset of columnOffsets) {
    const column = buildClearingColumn(scene, offset, clearingMaterial);
    column.parent = decorationRoot;
    clearingColumns.push(column);
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
      groundComposition.dispose();
      biomeAnchors.dispose();
      for (const column of clearingColumns) {
        column.dispose();
      }
      clearingMaterial.dispose();
      decorationRoot.dispose();
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

function buildClearingColumn(scene: Scene, offsetX: number, material: StandardMaterial): TransformNode {
  const root = new TransformNode(`clearing-column-${offsetX}`, scene);
  root.position = new Vector3(offsetX, 0, 4.2 - Math.abs(offsetX) * 0.12);

  const plinth = MeshBuilder.CreateCylinder(`clearing-plinth-${offsetX}`, { diameter: 1.1, height: 1.2, tessellation: 8 }, scene);
  plinth.parent = root;
  plinth.position = new Vector3(0, 0.6, 0);
  plinth.material = material;

  const cap = MeshBuilder.CreateSphere(`clearing-cap-${offsetX}`, { diameter: 0.72, segments: 8 }, scene);
  cap.parent = root;
  cap.position = new Vector3(0, 1.52, 0);
  cap.material = material;

  return root;
}
