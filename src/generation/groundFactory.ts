import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";

import type { QualityMode } from "../engine/sceneState";
import type { BiomeTheme } from "./biomeFactory";

export interface GroundComposition {
  dispose: () => void;
}

function createMaterial(scene: Scene, name: string, color: Color3, emissive?: Color3, alpha = 1): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = color;
  material.emissiveColor = emissive ?? Color3.Black();
  material.specularColor = Color3.Black();
  material.alpha = alpha;
  return material;
}

function createPathSegment(
  scene: Scene,
  name: string,
  center: Vector3,
  width: number,
  depth: number,
  rotationY: number,
  material: StandardMaterial
): Mesh {
  const segment = MeshBuilder.CreateBox(name, { width, depth, height: 0.14 }, scene);
  segment.position = center;
  segment.rotation.y = rotationY;
  segment.material = material;
  return segment;
}

export function createGroundComposition(
  scene: Scene,
  themes: BiomeTheme[],
  quality: QualityMode,
  zoneCenters: Map<BiomeTheme["id"], Vector3>
): GroundComposition {
  const materials: StandardMaterial[] = [];
  const meshes: Mesh[] = [];

  const clearingMaterial = createMaterial(
    scene,
    "clearing-material",
    new Color3(0.53, 0.48, 0.37),
    new Color3(0.045, 0.038, 0.025),
    0.98
  );
  materials.push(clearingMaterial);

  const clearing = MeshBuilder.CreateDisc("center-clearing", { radius: quality === "high" ? 11.5 : 10.5, tessellation: 64 }, scene);
  clearing.rotation.x = Math.PI / 2;
  clearing.position = new Vector3(0, 0.09, 0);
  clearing.material = clearingMaterial;
  meshes.push(clearing);

  const innerClearingMaterial = createMaterial(
    scene,
    "inner-clearing-material",
    new Color3(0.61, 0.56, 0.45),
    new Color3(0.03, 0.025, 0.02),
    0.92
  );
  materials.push(innerClearingMaterial);

  const innerClearing = MeshBuilder.CreateDisc("inner-clearing", { radius: quality === "high" ? 6.4 : 5.8, tessellation: 48 }, scene);
  innerClearing.rotation.x = Math.PI / 2;
  innerClearing.position = new Vector3(0, 0.1, 0);
  innerClearing.material = innerClearingMaterial;
  meshes.push(innerClearing);

  const pathMaterial = createMaterial(
    scene,
    "path-material",
    new Color3(0.65, 0.6, 0.48),
    new Color3(0.018, 0.016, 0.012),
    0.96
  );
  materials.push(pathMaterial);

  meshes.push(createPathSegment(scene, "path-left", new Vector3(-11.5, 0.08, -3.2), 18, 2.2, -0.18, pathMaterial));
  meshes.push(createPathSegment(scene, "path-center", new Vector3(0, 0.08, 10.4), 3.4, 18, 0, pathMaterial));
  meshes.push(createPathSegment(scene, "path-right", new Vector3(11.8, 0.08, -2.9), 18, 2.2, 0.16, pathMaterial));

  for (const theme of themes) {
    const center = zoneCenters.get(theme.id);
    if (!center) {
      continue;
    }

    const biomeBedMaterial = createMaterial(
      scene,
      `biome-bed-${theme.id}`,
      theme.groundTint.scale(0.88),
      theme.accentTint.scale(0.01),
      0.72
    );
    materials.push(biomeBedMaterial);

    const biomeBed = MeshBuilder.CreateDisc(
      `biome-bed-${theme.id}`,
      { radius: theme.id === "ai-systems" ? 10.8 : 9.4, tessellation: 56 },
      scene
    );
    biomeBed.rotation.x = Math.PI / 2;
    biomeBed.position = new Vector3(center.x, 0.06, center.z);
    biomeBed.scaling = theme.id === "ai-systems" ? new Vector3(0.9, 1, 1.25) : new Vector3(1, 1, 1.1);
    biomeBed.material = biomeBedMaterial;
    meshes.push(biomeBed);
  }

  return {
    dispose: () => {
      for (const mesh of meshes) {
        mesh.dispose();
      }

      for (const material of materials) {
        material.dispose();
      }
    }
  };
}
