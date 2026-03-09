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
import { getBiomeTheme } from "./biomeFactory";

type EmphasisState = "idle" | "hovered" | "selected";

interface TreeAssets {
  trunkTemplate: Mesh;
  branchTemplate: Mesh;
  canopyTemplate: Mesh;
  berryTemplate: Mesh;
  ringTemplate: Mesh;
}

export interface ProjectVisual {
  project: PortfolioItem;
  root: TransformNode;
  pickMeshes: AbstractMesh[];
  focusPoint: Vector3;
  focusRadius: number;
  setState: (state: EmphasisState) => void;
  dispose: () => void;
}

function createMaterial(scene: Scene, name: string, color: Color3, emissive = 0): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = color;
  material.specularColor = Color3.Black();
  material.emissiveColor = color.scale(emissive);
  return material;
}

export function createTreeAssets(scene: Scene): TreeAssets {
  const trunkTemplate = MeshBuilder.CreateCylinder(
    "tree-trunk-template",
    { height: 1, diameterTop: 0.72, diameterBottom: 1 },
    scene
  );
  trunkTemplate.isVisible = false;
  trunkTemplate.setEnabled(false);

  const branchTemplate = MeshBuilder.CreateCylinder(
    "tree-branch-template",
    { height: 1.1, diameterTop: 0.12, diameterBottom: 0.22 },
    scene
  );
  branchTemplate.isVisible = false;
  branchTemplate.setEnabled(false);

  const canopyTemplate = MeshBuilder.CreateSphere("tree-canopy-template", { diameter: 1.2, segments: 10 }, scene);
  canopyTemplate.isVisible = false;
  canopyTemplate.setEnabled(false);

  const berryTemplate = MeshBuilder.CreateSphere("tree-berry-template", { diameter: 0.24, segments: 8 }, scene);
  berryTemplate.isVisible = false;
  berryTemplate.setEnabled(false);

  const ringTemplate = MeshBuilder.CreateTorus("tree-ring-template", { diameter: 2.6, thickness: 0.08, tessellation: 32 }, scene);
  ringTemplate.isVisible = false;
  ringTemplate.setEnabled(false);

  return {
    trunkTemplate,
    branchTemplate,
    canopyTemplate,
    berryTemplate,
    ringTemplate
  };
}

export function disposeTreeAssets(assets: TreeAssets): void {
  assets.trunkTemplate.dispose();
  assets.branchTemplate.dispose();
  assets.canopyTemplate.dispose();
  assets.berryTemplate.dispose();
  assets.ringTemplate.dispose();
}

export function buildProjectTree(
  scene: Scene,
  assets: TreeAssets,
  project: PortfolioItem,
  quality: QualityMode,
  position: Vector3
): ProjectVisual {
  const root = new TransformNode(`project-root-${project.id}`, scene);
  root.position.copyFrom(position);

  const biome = getBiomeTheme(project.biomeID);
  const trunkMaterial = createMaterial(scene, `trunk-material-${project.id}`, biome.trunkTint);
  const canopyMaterial = createMaterial(scene, `canopy-material-${project.id}`, biome.foliageTint, 0.06);
  const berryMaterial = createMaterial(scene, `berry-material-${project.id}`, biome.accentTint, 0.2);
  const hoverRingMaterial = createMaterial(scene, `hover-ring-material-${project.id}`, biome.accentTint, 0.5);
  const selectedRingMaterial = createMaterial(
    scene,
    `selected-ring-material-${project.id}`,
    biome.accentTint.scale(0.9).add(new Color3(0.1, 0.1, 0.1)),
    0.8
  );

  const pickMeshes: AbstractMesh[] = [];
  const createdMeshes: AbstractMesh[] = [];
  const featuredBoost = project.featured ? 1.15 : 1;
  const trunkHeight = (3.6 + project.impact * 0.72) * featuredBoost;
  const trunkDiameter = 0.65 + project.scope * 0.14;
  const branchCountBase = Math.max(2, Math.min(7, project.tech.length + (quality === "high" ? 1 : 0)));
  const canopyCount = quality === "high" ? branchCountBase + 2 : branchCountBase;
  const canopySpread = 1.7 + project.scope * 0.14;

  const trunk = assets.trunkTemplate.createInstance(`trunk-${project.id}`);
  trunk.parent = root;
  trunk.position = new Vector3(0, trunkHeight / 2, 0);
  trunk.scaling = new Vector3(trunkDiameter, trunkHeight, trunkDiameter);
  trunk.material = trunkMaterial;
  trunk.isPickable = true;
  pickMeshes.push(trunk);
  createdMeshes.push(trunk);

  for (let index = 0; index < branchCountBase; index += 1) {
    const angle = (Math.PI * 2 * index) / branchCountBase;
    const branchHeight = trunkHeight * (0.42 + (index % 3) * 0.1);
    const branchLength = 1.6 + project.tech.length * 0.18 + (quality === "high" ? 0.3 : 0);
    const branch = assets.branchTemplate.createInstance(`branch-${project.id}-${index}`);
    branch.parent = root;
    branch.position = new Vector3(Math.cos(angle) * 0.32, branchHeight, Math.sin(angle) * 0.32);
    branch.scaling = new Vector3(0.9 + project.scope * 0.07, branchLength, 0.9 + project.scope * 0.07);
    branch.rotation = new Vector3(Math.PI / 2.7, angle, Math.PI / 3.8);
    branch.material = trunkMaterial;
    branch.isPickable = true;
    pickMeshes.push(branch);
    createdMeshes.push(branch);
  }

  for (let index = 0; index < canopyCount; index += 1) {
    const angle = (Math.PI * 2 * index) / canopyCount;
    const radius = canopySpread + (index % 2) * 0.55;
    const canopy = assets.canopyTemplate.createInstance(`canopy-${project.id}-${index}`);
    canopy.parent = root;
    canopy.position = new Vector3(
      Math.cos(angle) * radius,
      trunkHeight * 0.8 + (index % 3) * 0.5,
      Math.sin(angle) * radius
    );
    canopy.scaling = new Vector3(1.3 + project.impact * 0.13, 1.1 + project.scope * 0.07, 1.3 + project.impact * 0.13);
    canopy.material = canopyMaterial;
    canopy.isPickable = true;
    pickMeshes.push(canopy);
    createdMeshes.push(canopy);
  }

  if (project.featured || quality === "high") {
    const berryCount = project.featured ? 5 : 3;
    for (let index = 0; index < berryCount; index += 1) {
      const angle = (Math.PI * 2 * index) / berryCount;
      const berry = assets.berryTemplate.createInstance(`berry-${project.id}-${index}`);
      berry.parent = root;
      berry.position = new Vector3(
        Math.cos(angle) * (canopySpread * 0.75),
        trunkHeight * 0.84 + 0.35 * index,
        Math.sin(angle) * (canopySpread * 0.75)
      );
      berry.scaling = new Vector3(1.1, 1.1, 1.1);
      berry.material = berryMaterial;
      berry.isPickable = true;
      pickMeshes.push(berry);
      createdMeshes.push(berry);
    }
  }

  const ring = assets.ringTemplate.createInstance(`ring-${project.id}`);
  ring.parent = root;
  ring.position = new Vector3(0, 0.14, 0);
  ring.rotation = new Vector3(Math.PI / 2, 0, 0);
  ring.scaling = new Vector3(1 + project.scope * 0.08, 1, 1 + project.scope * 0.08);
  ring.material = hoverRingMaterial;
  ring.isPickable = false;
  ring.isVisible = false;
  createdMeshes.push(ring);

  for (const mesh of pickMeshes) {
    mesh.metadata = { projectId: project.id };
  }

  const setState = (state: EmphasisState): void => {
    if (state === "idle") {
      root.scaling = Vector3.One();
      ring.isVisible = false;
      return;
    }

    if (state === "hovered") {
      root.scaling = new Vector3(1.03, 1.03, 1.03);
      ring.material = hoverRingMaterial;
      ring.isVisible = true;
      return;
    }

    root.scaling = new Vector3(1.08, 1.08, 1.08);
    ring.material = selectedRingMaterial;
    ring.isVisible = true;
  };

  return {
    project,
    root,
    pickMeshes,
    focusPoint: position.add(new Vector3(0, trunkHeight * 0.68, 0)),
    focusRadius: 12 + project.scope * 0.75,
    setState,
    dispose: () => {
      trunkMaterial.dispose();
      canopyMaterial.dispose();
      berryMaterial.dispose();
      hoverRingMaterial.dispose();
      selectedRingMaterial.dispose();
      for (const mesh of createdMeshes) {
        mesh.dispose();
      }
      root.dispose();
    }
  };
}
