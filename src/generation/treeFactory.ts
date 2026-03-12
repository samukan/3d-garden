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
  capsuleTemplate: Mesh;
  boxTemplate: Mesh;
  ringTemplate: Mesh;
}

function normalizedHash(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return ((hash >>> 0) % 1000) / 1000;
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

function blendColors(from: Color3, to: Color3, amount: number): Color3 {
  return new Color3(
    from.r + (to.r - from.r) * amount,
    from.g + (to.g - from.g) * amount,
    from.b + (to.b - from.b) * amount
  );
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

  const canopyTemplate = MeshBuilder.CreateSphere("tree-canopy-template", { diameter: 1.2, segments: 13 }, scene);
  canopyTemplate.isVisible = false;
  canopyTemplate.setEnabled(false);

  const berryTemplate = MeshBuilder.CreateSphere("tree-berry-template", { diameter: 0.24, segments: 8 }, scene);
  berryTemplate.isVisible = false;
  berryTemplate.setEnabled(false);

  const capsuleTemplate = MeshBuilder.CreateSphere("project-capsule-template", { diameter: 1, segments: 12 }, scene);
  capsuleTemplate.isVisible = false;
  capsuleTemplate.setEnabled(false);

  const boxTemplate = MeshBuilder.CreateBox("project-box-template", { size: 1 }, scene);
  boxTemplate.isVisible = false;
  boxTemplate.setEnabled(false);

  const ringTemplate = MeshBuilder.CreateTorus("tree-ring-template", { diameter: 2.6, thickness: 0.08, tessellation: 32 }, scene);
  ringTemplate.isVisible = false;
  ringTemplate.setEnabled(false);

  return {
    trunkTemplate,
    branchTemplate,
    canopyTemplate,
    berryTemplate,
    capsuleTemplate,
    boxTemplate,
    ringTemplate
  };
}

export function disposeTreeAssets(assets: TreeAssets): void {
  assets.trunkTemplate.dispose();
  assets.branchTemplate.dispose();
  assets.canopyTemplate.dispose();
  assets.berryTemplate.dispose();
  assets.capsuleTemplate.dispose();
  assets.boxTemplate.dispose();
  assets.ringTemplate.dispose();
}

interface FormBuildResult {
  focusHeight: number;
}

function addCreativeTechForm(
  root: TransformNode,
  assets: TreeAssets,
  project: PortfolioItem,
  trunkMaterial: StandardMaterial,
  canopyMaterial: StandardMaterial,
  accentMaterial: StandardMaterial,
  pickMeshes: AbstractMesh[],
  createdMeshes: AbstractMesh[]
): FormBuildResult {
  const baseHeight = 5.1 + project.impact * 0.52;

  const trunk = assets.trunkTemplate.createInstance(`creative-trunk-${project.id}`);
  trunk.parent = root;
  trunk.position = new Vector3(0, baseHeight / 2, 0);
  trunk.scaling = new Vector3(1.05 + project.scope * 0.08, baseHeight, 1.05 + project.scope * 0.08);
  trunk.material = trunkMaterial;
  trunk.isPickable = true;
  pickMeshes.push(trunk);
  createdMeshes.push(trunk);

  const shard = assets.boxTemplate.createInstance(`creative-shard-${project.id}`);
  shard.parent = root;
  shard.position = new Vector3(0.8, baseHeight + 0.7, 0.15);
  shard.scaling = new Vector3(1.35, 2.1, 0.65);
  shard.rotation = new Vector3(0.28, 0.38, -0.12);
  shard.material = accentMaterial;
  shard.isPickable = true;
  pickMeshes.push(shard);
  createdMeshes.push(shard);

  for (let index = 0; index < 3; index += 1) {
    const variation = normalizedHash(`${project.id}-creative-${index}`);
    const canopy = assets.capsuleTemplate.createInstance(`creative-pod-${project.id}-${index}`);
    canopy.parent = root;
    canopy.position = new Vector3(-1.6 + index * 1.5, baseHeight * (0.78 + variation * 0.18), 0.6 - index * 0.55);
    canopy.scaling = new Vector3(1.2 + variation * 0.35, 1.7 + variation * 0.45, 1.2 + variation * 0.35);
    canopy.rotation = new Vector3(0.12 + variation * 0.22, variation * 0.5, 0.08 + variation * 0.18);
    canopy.material = canopyMaterial;
    canopy.isPickable = true;
    pickMeshes.push(canopy);
    createdMeshes.push(canopy);
  }

  return { focusHeight: baseHeight + 1.8 };
}

function addAiSystemsForm(
  root: TransformNode,
  assets: TreeAssets,
  project: PortfolioItem,
  trunkMaterial: StandardMaterial,
  canopyMaterial: StandardMaterial,
  accentMaterial: StandardMaterial,
  pickMeshes: AbstractMesh[],
  createdMeshes: AbstractMesh[]
): FormBuildResult {
  const mastHeight = 4.6 + project.impact * 0.44;
  const mast = assets.boxTemplate.createInstance(`ai-mast-${project.id}`);
  mast.parent = root;
  mast.position = new Vector3(0, mastHeight / 2, 0);
  mast.scaling = new Vector3(0.82 + project.scope * 0.07, mastHeight, 0.82 + project.scope * 0.07);
  mast.material = trunkMaterial;
  mast.isPickable = true;
  pickMeshes.push(mast);
  createdMeshes.push(mast);

  const nodeCount = Math.max(3, Math.min(5, project.tech.length > 6 ? 5 : 4));
  for (let index = 0; index < nodeCount; index += 1) {
    const variation = normalizedHash(`${project.id}-ai-${index}`);
    const pod = assets.capsuleTemplate.createInstance(`ai-pod-${project.id}-${index}`);
    pod.parent = root;
    pod.position = new Vector3(-1.7 + index * 0.88, mastHeight * (0.56 + index * 0.09), -0.45 + variation * 0.8);
    pod.scaling = new Vector3(1.18 + variation * 0.18, 0.54 + variation * 0.08, 0.54 + variation * 0.08);
    pod.material = canopyMaterial;
    pod.isPickable = true;
    pickMeshes.push(pod);
    createdMeshes.push(pod);
  }

  const cap = assets.boxTemplate.createInstance(`ai-cap-${project.id}`);
  cap.parent = root;
  cap.position = new Vector3(0, mastHeight + 0.35, 0);
  cap.scaling = new Vector3(2.6, 0.18, 0.9);
  cap.material = accentMaterial;
  cap.isPickable = true;
  pickMeshes.push(cap);
  createdMeshes.push(cap);

  return { focusHeight: mastHeight + 0.8 };
}

function addProductAppsForm(
  root: TransformNode,
  assets: TreeAssets,
  project: PortfolioItem,
  trunkMaterial: StandardMaterial,
  canopyMaterial: StandardMaterial,
  accentMaterial: StandardMaterial,
  pickMeshes: AbstractMesh[],
  createdMeshes: AbstractMesh[]
): FormBuildResult {
  const trunkHeight = 3.4 + project.impact * 0.38;
  const trunk = assets.trunkTemplate.createInstance(`product-trunk-${project.id}`);
  trunk.parent = root;
  trunk.position = new Vector3(0, trunkHeight / 2, 0);
  trunk.scaling = new Vector3(0.95 + project.scope * 0.07, trunkHeight, 0.95 + project.scope * 0.07);
  trunk.material = trunkMaterial;
  trunk.isPickable = true;
  pickMeshes.push(trunk);
  createdMeshes.push(trunk);

  const canopyPositions = [new Vector3(-1.4, trunkHeight + 0.7, 0.25), new Vector3(1.35, trunkHeight + 0.9, -0.2), new Vector3(0.1, trunkHeight + 1.4, 1.15)];
  canopyPositions.forEach((position, index) => {
    const variation = normalizedHash(`${project.id}-product-${index}`);
    const canopy = assets.canopyTemplate.createInstance(`product-canopy-${project.id}-${index}`);
    canopy.parent = root;
    canopy.position = position;
    canopy.scaling = new Vector3(1.55 + variation * 0.3, 1.35 + variation * 0.22, 1.55 + variation * 0.3);
    canopy.material = canopyMaterial;
    canopy.isPickable = true;
    pickMeshes.push(canopy);
    createdMeshes.push(canopy);
  });

  const accent = assets.berryTemplate.createInstance(`product-accent-${project.id}`);
  accent.parent = root;
  accent.position = new Vector3(0.9, trunkHeight + 1.2, 1.35);
  accent.scaling = new Vector3(1.8, 1.8, 1.8);
  accent.material = accentMaterial;
  accent.isPickable = true;
  pickMeshes.push(accent);
  createdMeshes.push(accent);

  return { focusHeight: trunkHeight + 2.1 };
}

export function buildProjectTree(
  scene: Scene,
  assets: TreeAssets,
  project: PortfolioItem,
  _quality: QualityMode,
  position: Vector3
): ProjectVisual {
  const root = new TransformNode(`project-root-${project.id}`, scene);
  root.position.copyFrom(position);

  const biome = getBiomeTheme(project.biomeID);
  const impactWeight = project.impact / 10;
  const scopeWeight = project.scope / 10;
  const techWeight = Math.min(project.tech.length / 7, 1);
  const trunkColor = blendColors(biome.trunkTint, biome.accentTint.scale(0.55), 0.12 + scopeWeight * 0.18);
  const canopyColor = blendColors(biome.foliageTint, biome.accentTint, 0.08 + impactWeight * 0.18 + techWeight * 0.08);
  const berryColor = blendColors(biome.accentTint, new Color3(1, 0.98, 0.93), project.featured ? 0.25 : 0.1);

  const trunkMaterial = createMaterial(scene, `trunk-material-${project.id}`, trunkColor, 0.02 + scopeWeight * 0.03);
  const canopyMaterial = createMaterial(scene, `canopy-material-${project.id}`, canopyColor, 0.08 + impactWeight * 0.05);
  const berryMaterial = createMaterial(scene, `berry-material-${project.id}`, berryColor, 0.24);
  const hoverRingMaterial = createMaterial(scene, `hover-ring-material-${project.id}`, biome.accentTint, 0.5);
  const selectedRingMaterial = createMaterial(
    scene,
    `selected-ring-material-${project.id}`,
    biome.accentTint.scale(0.9).add(new Color3(0.1, 0.1, 0.1)),
    0.8
  );

  const pickMeshes: AbstractMesh[] = [];
  const createdMeshes: AbstractMesh[] = [];
  const baseCanopyEmissive = 0.12 + impactWeight * 0.08;
  const baseTrunkEmissive = 0.03 + scopeWeight * 0.03;
  let formResult: FormBuildResult;

  if (project.biomeID === "creative-tech") {
    formResult = addCreativeTechForm(root, assets, project, trunkMaterial, canopyMaterial, berryMaterial, pickMeshes, createdMeshes);
  } else if (project.biomeID === "ai-systems") {
    formResult = addAiSystemsForm(root, assets, project, trunkMaterial, canopyMaterial, berryMaterial, pickMeshes, createdMeshes);
  } else {
    formResult = addProductAppsForm(root, assets, project, trunkMaterial, canopyMaterial, berryMaterial, pickMeshes, createdMeshes);
  }

  const ring = assets.ringTemplate.createInstance(`ring-${project.id}`);
  ring.parent = root;
  ring.position = new Vector3(0, 0.14, 0);
  ring.rotation = new Vector3(Math.PI / 2, 0, 0);
  ring.scaling = new Vector3(1.3 + project.scope * 0.1, 1, 1.3 + project.scope * 0.1);
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
      canopyMaterial.emissiveColor = canopyColor.scale(baseCanopyEmissive);
      trunkMaterial.emissiveColor = trunkColor.scale(baseTrunkEmissive);
      return;
    }

    if (state === "hovered") {
      root.scaling = new Vector3(1.035, 1.035, 1.035);
      ring.material = hoverRingMaterial;
      ring.isVisible = true;
      ring.scaling = new Vector3(1.46 + project.scope * 0.08, 1, 1.46 + project.scope * 0.08);
      canopyMaterial.emissiveColor = canopyColor.scale(baseCanopyEmissive + 0.11);
      trunkMaterial.emissiveColor = trunkColor.scale(baseTrunkEmissive + 0.04);
      return;
    }

    root.scaling = new Vector3(1.05, 1.05, 1.05);
    ring.material = selectedRingMaterial;
    ring.isVisible = true;
    ring.scaling = new Vector3(1.64 + project.scope * 0.08, 1, 1.64 + project.scope * 0.08);
    canopyMaterial.emissiveColor = canopyColor.scale(baseCanopyEmissive + 0.16);
    trunkMaterial.emissiveColor = trunkColor.scale(baseTrunkEmissive + 0.06);
  };

  return {
    project,
    root,
    pickMeshes,
    focusPoint: position.add(new Vector3(0, formResult.focusHeight, 0)),
    focusRadius: project.biomeID === "ai-systems" ? 14.5 : 13 + project.scope * 0.6,
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
