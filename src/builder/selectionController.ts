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

  if (isWebGpu) {
    return {
      setSelection: () => {},
      dispose: () => {}
    };
  }

  const highlightLayer = new HighlightLayer("builder-selection-layer", scene);
  let selectedMeshes: Mesh[] = [];

  const setSelection = (meshes: Mesh[]): void => {
    for (const mesh of selectedMeshes) {
      highlightLayer.removeMesh(mesh);
    }

    selectedMeshes = meshes;

    for (const mesh of selectedMeshes) {
      highlightLayer.addMesh(mesh, new Color3(1, 0.84, 0.42));
    }
  };

  return {
    setSelection,
    dispose: () => {
      setSelection([]);
      highlightLayer.dispose();
    }
  };
}