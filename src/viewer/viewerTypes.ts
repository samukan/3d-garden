import type {
  BuilderLayoutRecord,
  BuilderVector3,
  BuilderWorldCameraRoutesMetadata
} from "../builder/builderTypes";

export type ViewerWorldSource = "saved-world" | "json-file";

export type ViewerLoadState = "loading" | "ready" | "partial" | "error";

export interface ViewerLoadIssue {
  type: "missing-asset" | "instantiate-failed";
  objectId: string;
  assetId: string;
  message: string;
}

export interface ViewerWorldBounds {
  min: BuilderVector3;
  max: BuilderVector3;
  center: BuilderVector3;
  size: BuilderVector3;
  radius: number;
}

export interface ViewerWorldDocument {
  source: ViewerWorldSource;
  sourceId: string;
  name: string;
  layoutRecords: BuilderLayoutRecord[];
  cameraRoutes: BuilderWorldCameraRoutesMetadata | undefined;
  objectCount: number;
  updatedAt: string;
  editableWorldId: string | null;
}

export type ViewerWorldResolution =
  | {
      success: true;
      world: ViewerWorldDocument;
    }
  | {
      success: false;
      error: string;
    };
