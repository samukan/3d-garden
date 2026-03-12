import type { BuilderLayoutRecord } from "./builderTypes";

export interface BuilderSceneRuntimeState {
  isReady: boolean;
  selectedObjectId: string | null;
  layoutRecords: BuilderLayoutRecord[];
  statusMessage: string;
}

export function createBuilderSceneState(): BuilderSceneRuntimeState {
  return {
    isReady: false,
    selectedObjectId: null,
    layoutRecords: [],
    statusMessage: "Loading builder assets..."
  };
}
