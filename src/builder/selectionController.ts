import { HighlightLayer } from "@babylonjs/core/Layers/highlightLayer";
import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import "@babylonjs/core/Layers";
import "@babylonjs/core/Layers/effectLayerSceneComponent";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Scene } from "@babylonjs/core/scene";

export interface SelectionController {
  setSelection: (meshes: Mesh[]) => void;
  dispose: () => void;
}

export function createSelectionController(scene: Scene): SelectionController {
  const engine = scene.getEngine();
  const isWebGpu = engine instanceof WebGPUEngine || engine.getClassName?.() === "WebGPUEngine";
  let highlightLayer: HighlightLayer | null = null;
  if (!isWebGpu) {
    try {
      highlightLayer = new HighlightLayer("builder-selection-layer", scene);
    } catch {
      highlightLayer = null;
    }
  }
  let selectedMeshes: Mesh[] = [];
  const highlightColor = new Color3(1, 0.84, 0.42);

  const setFallbackSelection = (mesh: Mesh, enabled: boolean): void => {
    if (mesh.isDisposed()) {
      return;
    }

    mesh.showBoundingBox = enabled;
  };

  const setSelection = (meshes: Mesh[]): void => {
    for (const mesh of selectedMeshes) {
      highlightLayer?.removeMesh(mesh);
      setFallbackSelection(mesh, false);
    }

    selectedMeshes = meshes;

    for (const mesh of selectedMeshes) {
      highlightLayer?.addMesh(mesh, highlightColor);
      setFallbackSelection(mesh, true);
    }
  };

  return {
    setSelection,
    dispose: () => {
      setSelection([]);
      highlightLayer?.dispose();
    }
  };
}
