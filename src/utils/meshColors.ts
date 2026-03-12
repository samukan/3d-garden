import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Material } from "@babylonjs/core/Materials/material";
import { MultiMaterial } from "@babylonjs/core/Materials/multiMaterial";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";

import { logBrowserDebug } from "./browserDebug";

interface MeshColorOptions {
  log?: boolean;
}

function enableMaterialVertexColors(material: Material, meshName: string, options?: MeshColorOptions): void {
  const materialFlags = material as { useVertexColor?: boolean; useVertexColors?: boolean };
  if (materialFlags.useVertexColors !== undefined) {
    materialFlags.useVertexColors = true;
  }
  if (materialFlags.useVertexColor !== undefined) {
    materialFlags.useVertexColor = true;
  }

  if (options?.log) {
    logBrowserDebug("mesh:vertex-colors-enabled", {
      mesh: meshName,
      material: material.name,
      materialType: typeof material.getClassName === "function" ? material.getClassName() : material.constructor.name
    });
  }
}

function applyVertexColorFallback(mesh: Mesh, options?: MeshColorOptions): void {
  const fallback = new StandardMaterial(`${mesh.name}-vertex-colors`, mesh.getScene());
  fallback.diffuseColor = Color3.White();
  fallback.emissiveColor = Color3.Black();
  fallback.specularColor = Color3.Black();
  (fallback as { useVertexColors?: boolean }).useVertexColors = true;
  mesh.material = fallback;

  if (options?.log) {
    logBrowserDebug("mesh:vertex-colors-fallback", {
      mesh: mesh.name,
      material: fallback.name,
      materialType: "StandardMaterial"
    });
  }
}

export function enableMeshVertexColors(mesh: Mesh, options?: MeshColorOptions): void {
  if (!mesh.isVerticesDataPresent(VertexBuffer.ColorKind)) {
    if (options?.log) {
      logBrowserDebug("mesh:vertex-colors-missing", {
        mesh: mesh.name
      });
    }
    return;
  }

  mesh.useVertexColors = true;

  if (!mesh.material) {
    applyVertexColorFallback(mesh, options);
    return;
  }

  if (mesh.material instanceof MultiMaterial) {
    for (const subMaterial of mesh.material.subMaterials ?? []) {
      if (subMaterial) {
        enableMaterialVertexColors(subMaterial, mesh.name, options);
      }
    }
    return;
  }

  enableMaterialVertexColors(mesh.material, mesh.name, options);
}
