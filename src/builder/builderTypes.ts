import type { AssetId } from "../generation/natureKitAssetManifest";

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
  selectedObjectId: string | null;
  selectedObject: BuilderSelectedObjectSnapshot | null;
  statusMessage: string;
}

export interface BuilderLayoutDocument {
  objects: BuilderLayoutRecord[];
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
