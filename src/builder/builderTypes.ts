import type { AssetId } from "../generation/natureKitAssetManifest";
import type {
  CameraRouteDefinition,
  CameraRouteEasing,
  CameraRouteTiming
} from "../camera-routes/cameraRouteTypes";

export interface BuilderVector3 {
  x: number;
  y: number;
  z: number;
}

export interface BuilderLayoutRecord {
  id: string;
  assetId: AssetId;
  position: BuilderVector3;
  rotationY: number;
  scale: number;
}

export interface BuilderPaletteItem {
  assetId: AssetId;
  label: string;
  sourceType: "built-in" | "uploaded";
  uploadedAt: string | null;
  uploadedCategory: string | null;
}

export interface BuilderSelectedObjectSnapshot extends BuilderLayoutRecord {
  assetLabel: string;
}

export interface BuilderPlacedObjectSnapshot extends BuilderLayoutRecord {
  assetLabel: string;
}

export interface BuilderSceneSnapshot {
  isReady: boolean;
  palette: BuilderPaletteItem[];
  objects: BuilderPlacedObjectSnapshot[];
  selectedObjectIds: string[];
  primarySelectedObjectId: string | null;
  primarySelectedObject: BuilderSelectedObjectSnapshot | null;
  selectedObjectId: string | null;
  selectedObject: BuilderSelectedObjectSnapshot | null;
  statusMessage: string;
}

export interface BuilderLayoutDocument {
  version?: 1;
  objects: BuilderLayoutRecord[];
  metadata?: BuilderWorldMetadata;
}

export interface BuilderWorldCameraRoutesMetadata {
  defaultRouteId?: string;
  routes: CameraRouteDefinition[];
}

export interface BuilderWorldMetadata {
  cameraRoutes?: BuilderWorldCameraRoutesMetadata;
}

export type BuilderRoutePointMoveDirection = "up" | "down";

export interface BuilderRouteSettingsPatch {
  name?: string;
  loop?: boolean;
  easing?: CameraRouteEasing;
  timing?: CameraRouteTiming;
}

export interface BuilderRouteEditState {
  routeModeEnabled: boolean;
  selectedRouteId: string | null;
  selectedPointIndex: number | null;
  isPreviewPlaying: boolean;
  defaultRouteId: string | null;
  routes: CameraRouteDefinition[];
}

export interface SavedWorldSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  objectCount: number;
}

export interface SavedWorldRecord extends SavedWorldSummary {
  layout: string;
}
