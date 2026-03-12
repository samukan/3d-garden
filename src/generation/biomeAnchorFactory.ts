import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";

import type { QualityMode } from "../engine/sceneState";
import type { BiomeTheme } from "./biomeFactory";

export interface BiomeAnchorComposition {
  dispose: () => void;
}

function createMaterial(scene: Scene, name: string, color: Color3, emissive = 0): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = color;
  material.emissiveColor = color.scale(emissive);
  material.specularColor = Color3.Black();
  return material;
}

function createCreativeTechAnchor(scene: Scene, root: TransformNode, theme: BiomeTheme, quality: QualityMode): Mesh[] {
  const meshes: Mesh[] = [];
  const stoneMaterial = createMaterial(scene, `${theme.id}-anchor-stone`, theme.trunkTint.scale(0.95), 0.01);
  const accentMaterial = createMaterial(scene, `${theme.id}-anchor-accent`, theme.accentTint.scale(0.92), 0.1);

  const base = MeshBuilder.CreateCylinder(`${theme.id}-anchor-base`, { diameter: 6.8, height: 0.75, tessellation: 6 }, scene);
  base.parent = root;
  base.position = new Vector3(0, 0.36, -2);
  base.material = stoneMaterial;
  meshes.push(base);

  const spine = MeshBuilder.CreatePolyhedron(`${theme.id}-anchor-spine`, { size: 2.5, type: 2 }, scene) as Mesh;
  spine.parent = root;
  spine.position = new Vector3(0, 3.2, -1.8);
  spine.scaling = new Vector3(1.15, 2.8, 0.9);
  spine.rotation = new Vector3(0.12, 0.2, -0.14);
  spine.material = accentMaterial;
  meshes.push(spine);

  const secondary = MeshBuilder.CreatePolyhedron(`${theme.id}-anchor-secondary`, { size: 1.5, type: 0 }, scene) as Mesh;
  secondary.parent = root;
  secondary.position = new Vector3(-2.4, 1.8, -0.7);
  secondary.scaling = new Vector3(1.1, 1.9, 1.1);
  secondary.rotation = new Vector3(0.2, -0.3, 0.08);
  secondary.material = stoneMaterial;
  meshes.push(secondary);

  if (quality === "high") {
    const accent = MeshBuilder.CreateSphere(`${theme.id}-anchor-orb`, { diameter: 1.35, segments: 10 }, scene);
    accent.parent = root;
    accent.position = new Vector3(1.8, 2.1, -0.2);
    accent.material = accentMaterial;
    meshes.push(accent);
  }

  return meshes;
}

function createAiSystemsAnchor(scene: Scene, root: TransformNode, theme: BiomeTheme, quality: QualityMode): Mesh[] {
  const meshes: Mesh[] = [];
  const postMaterial = createMaterial(scene, `${theme.id}-anchor-post`, theme.trunkTint.scale(0.92), 0.015);
  const capMaterial = createMaterial(scene, `${theme.id}-anchor-cap`, theme.accentTint.scale(0.95), 0.06);

  const rowCount = quality === "high" ? 4 : 3;
  for (let index = 0; index < rowCount; index += 1) {
    const x = -4.2 + index * 2.8;
    const post = MeshBuilder.CreateBox(`${theme.id}-post-${index}`, { width: 0.75, depth: 0.75, height: 4.6 - index * 0.35 }, scene);
    post.parent = root;
    post.position = new Vector3(x, 2.3 - index * 0.18, -2.4 + index * 0.95);
    post.material = postMaterial;
    meshes.push(post);

    const cap = MeshBuilder.CreateCylinder(`${theme.id}-cap-${index}`, { diameter: 1.4, height: 0.28, tessellation: 20 }, scene);
    cap.parent = root;
    cap.position = new Vector3(x, post.position.y + post.scaling.y * 0.5 + 0.4, post.position.z);
    cap.material = capMaterial;
    meshes.push(cap);
  }

  return meshes;
}

function createProductAppsAnchor(scene: Scene, root: TransformNode, theme: BiomeTheme, quality: QualityMode): Mesh[] {
  const meshes: Mesh[] = [];
  const moundMaterial = createMaterial(scene, `${theme.id}-anchor-mound`, theme.foliageTint.scale(0.92), 0.02);
  const stoneMaterial = createMaterial(scene, `${theme.id}-anchor-stone`, theme.trunkTint.scale(0.98), 0.01);

  const moundCount = quality === "high" ? 4 : 3;
  for (let index = 0; index < moundCount; index += 1) {
    const mound = MeshBuilder.CreateSphere(`${theme.id}-mound-${index}`, { diameter: 2.4 + index * 0.35, segments: 12 }, scene);
    mound.parent = root;
    mound.position = new Vector3(-3.2 + index * 2.6, 1.05 + (index % 2) * 0.15, -1.8 + index * 0.8);
    mound.scaling = new Vector3(1.2, 0.78, 1.1);
    mound.material = moundMaterial;
    meshes.push(mound);
  }

  const bench = MeshBuilder.CreateBox(`${theme.id}-bench`, { width: 4.6, depth: 1.15, height: 0.35 }, scene);
  bench.parent = root;
  bench.position = new Vector3(0, 0.42, -3.3);
  bench.material = stoneMaterial;
  meshes.push(bench);

  return meshes;
}

export function createBiomeAnchors(
  scene: Scene,
  themes: BiomeTheme[],
  quality: QualityMode,
  zoneCenters: Map<BiomeTheme["id"], Vector3>
): BiomeAnchorComposition {
  const root = new TransformNode("biome-anchor-root", scene);
  const meshes: Mesh[] = [];
  const materials = new Set<StandardMaterial>();

  for (const theme of themes) {
    const center = zoneCenters.get(theme.id);
    if (!center) {
      continue;
    }

    const biomeRoot = new TransformNode(`biome-anchor-${theme.id}`, scene);
    biomeRoot.parent = root;
    biomeRoot.position = new Vector3(center.x, 0, center.z);

    if (theme.id === "creative-tech") {
      const created = createCreativeTechAnchor(scene, biomeRoot, theme, quality);
      created.forEach((mesh) => {
        meshes.push(mesh);
        if (mesh.material instanceof StandardMaterial) {
          materials.add(mesh.material);
        }
      });
      continue;
    }

    if (theme.id === "ai-systems") {
      const created = createAiSystemsAnchor(scene, biomeRoot, theme, quality);
      created.forEach((mesh) => {
        meshes.push(mesh);
        if (mesh.material instanceof StandardMaterial) {
          materials.add(mesh.material);
        }
      });
      continue;
    }

    const created = createProductAppsAnchor(scene, biomeRoot, theme, quality);
    created.forEach((mesh) => {
      meshes.push(mesh);
      if (mesh.material instanceof StandardMaterial) {
        materials.add(mesh.material);
      }
    });
  }

  return {
    dispose: () => {
      for (const mesh of meshes) {
        mesh.dispose();
      }
      for (const material of materials) {
        material.dispose();
      }
      root.dispose();
    }
  };
}
