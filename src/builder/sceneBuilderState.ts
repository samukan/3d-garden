import type { BuilderLayoutRecord } from "./builderTypes";

export interface BuilderSceneRuntimeState {
  isPanelOpen: boolean;
  isReady: boolean;
  selectedObjectId: string | null;
  layoutRecords: BuilderLayoutRecord[];
  statusMessage: string;
}

export function createBuilderSceneState(): BuilderSceneRuntimeState {
  return {
    isPanelOpen: true,
    isReady: false,
    selectedObjectId: null,
    layoutRecords: [],
    statusMessage: "Loading builder assets..."
  };
}