import type { NatureKitAssetKey } from "../generation/natureKitAssetManifest";

export interface BuilderVector3 {
  x: number;
  y: number;
  z: number;
}

export interface BuilderLayoutRecord {
  id: string;
  assetId: NatureKitAssetKey;
  position: BuilderVector3;
  rotationY: number;
  scale: number;
}

export interface BuilderPaletteItem {
  assetId: NatureKitAssetKey;
  label: string;
}

export interface BuilderPaletteGroup {
  id: string;
  label: string;
  items: BuilderPaletteItem[];
}

export interface BuilderSelectedObjectSnapshot extends BuilderLayoutRecord {
  assetLabel: string;
}

export interface BuilderSceneSnapshot {
  isReady: boolean;
  palette: BuilderPaletteGroup[];
  objects: BuilderLayoutRecord[];
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