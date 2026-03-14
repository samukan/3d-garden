import type { BuilderLayoutRecord, BuilderWorldMetadata } from "./builderTypes";

export interface BuilderSceneRuntimeState {
  isReady: boolean;
  selectedObjectIds: string[];
  primarySelectedObjectId: string | null;
  selectedObjectId: string | null;
  layoutRecords: BuilderLayoutRecord[];
  layoutMetadata: BuilderWorldMetadata | undefined;
  statusMessage: string;
}

export function createBuilderSceneState(): BuilderSceneRuntimeState {
  return {
    isReady: false,
    selectedObjectIds: [],
    primarySelectedObjectId: null,
    selectedObjectId: null,
    layoutRecords: [],
    layoutMetadata: undefined,
    statusMessage: "Loading builder assets..."
  };
}
