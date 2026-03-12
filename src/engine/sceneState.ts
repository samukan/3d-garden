import { Vector3 } from "@babylonjs/core/Maths/math.vector";

export type QualityMode = "low" | "high";

export interface SceneRuntimeState {
  hoveredProjectId: string | null;
  selectedProjectId: string | null;
  quality: QualityMode;
  desiredCameraTarget: Vector3;
  desiredCameraRadius: number;
}

export function createSceneState(initialQuality: QualityMode): SceneRuntimeState {
  return {
    hoveredProjectId: null,
    selectedProjectId: null,
    quality: initialQuality,
    desiredCameraTarget: new Vector3(0, 4.8, 7.5),
    desiredCameraRadius: 50
  };
}
