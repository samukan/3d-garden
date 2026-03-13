import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { z } from "zod";

import { cloneBuilderWorldMetadata } from "../builder/sceneLayoutSerializer";
import type { BuilderLayoutRecord, BuilderWorldMetadata } from "../builder/builderTypes";
import { getBuiltInAssetDefinitions } from "../generation/natureKitAssetManifest";
import {
  createUploadedAssetId,
  getUploadedAssetSnapshot,
  saveImportedUploadedAsset
} from "../storage/uploadedAssetStore";

const WORLD_JSON_ENTRY_NAME = "world.json";
const WORLD_PACKAGE_EXTENSION = ".sgw";

export const WORLD_PACKAGE_FORMAT = "skill-garden.world-package";
export const WORLD_PACKAGE_VERSION = 1;

const builderVector3Schema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite()
});

const builderLayoutRecordSchema = z.object({
  id: z.string().min(1),
  assetId: z.string().min(1),
  position: builderVector3Schema,
  rotationY: z.number().finite(),
  scale: z.number().positive()
});

const cameraRoutePointVectorSchema = z.tuple([
  z.number().finite(),
  z.number().finite(),
  z.number().finite()
]);

const cameraRoutePointSchema = z.object({
  position: cameraRoutePointVectorSchema,
  lookAt: cameraRoutePointVectorSchema,
  dwellMs: z.number().finite().nonnegative().optional()
});

const cameraRouteTimingSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("duration"),
    totalDurationMs: z.number().finite().nonnegative()
  }),
  z.object({
    mode: z.literal("speed"),
    unitsPerSecond: z.number().finite().positive()
  })
]);

const cameraRouteSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  loop: z.boolean(),
  timing: cameraRouteTimingSchema,
  easing: z.enum(["linear", "easeInOutSine"]).optional(),
  points: z.array(cameraRoutePointSchema)
});

const worldCameraRoutesMetadataSchema = z.object({
  defaultRouteId: z.string().min(1).optional(),
  routes: z.array(cameraRouteSchema)
});

const worldLayoutMetadataSchema = z.object({
  cameraRoutes: worldCameraRoutesMetadataSchema.optional()
});

const versionedLayoutSchema = z.object({
  version: z.literal(1),
  objects: z.array(builderLayoutRecordSchema),
  metadata: worldLayoutMetadataSchema.optional()
});

const builtInAssetEntrySchema = z.object({
  kind: z.literal("built-in"),
  id: z.string().min(1),
  label: z.string().min(1).optional()
});

const uploadedAssetEntrySchema = z.object({
  kind: z.literal("uploaded"),
  id: z.string().min(1),
  file: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  byteLength: z.number().int().positive(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  label: z.string().min(1),
  category: z.string().min(1),
  uploadedAt: z.string().min(1),
  rotationY: z.number().finite(),
  scale: z.number().positive()
});

const worldPackageAssetEntrySchema = z.discriminatedUnion("kind", [
  builtInAssetEntrySchema,
  uploadedAssetEntrySchema
]);

const worldPackageMetadataSchema = z.object({
  worldName: z.string().min(1),
  exportedAt: z.string().min(1),
  exportedFromAppVersion: z.string().min(1),
  objectCount: z.number().int().nonnegative()
});

const worldPackageDocumentSchema = z.object({
  format: z.literal(WORLD_PACKAGE_FORMAT),
  version: z.literal(WORLD_PACKAGE_VERSION),
  metadata: worldPackageMetadataSchema,
  layout: versionedLayoutSchema,
  assets: z.array(worldPackageAssetEntrySchema)
});

type WorldPackageDocument = z.infer<typeof worldPackageDocumentSchema>;
type UploadedAssetPackageEntry = z.infer<typeof uploadedAssetEntrySchema>;

export interface WorldPackageBuiltInAssetInput {
  id: string;
  label: string;
}

export interface WorldPackageUploadedAssetInput {
  blob: Blob;
  category: string;
  fileName: string;
  id: string;
  label: string;
  mimeType: string;
  rotationY: number;
  scale: number;
  uploadedAt: string;
}

export interface CreateWorldPackageInput {
  builtInAssets: WorldPackageBuiltInAssetInput[];
  exportedAt?: string;
  exportedFromAppVersion?: string;
  layoutMetadata?: BuilderWorldMetadata;
  layoutRecords: BuilderLayoutRecord[];
  uploadedAssets: WorldPackageUploadedAssetInput[];
  worldName: string;
}

export interface CreateWorldPackageResult {
  blob: Blob;
  fileName: string;
  objectCount: number;
  uploadedAssetCount: number;
}

interface ParsedWorldPackageUploadedAsset {
  blob: Blob;
  manifest: UploadedAssetPackageEntry;
}

interface ParsedWorldPackage {
  document: WorldPackageDocument;
  uploadedAssets: ParsedWorldPackageUploadedAsset[];
}

export interface ImportWorldPackageResult {
  importedUploadedAssetCount: number;
  layoutJson: string;
  layoutRecords: BuilderLayoutRecord[];
  remappedAssetCount: number;
  reusedUploadedAssetCount: number;
  uploadedAssetCount: number;
  worldName: string;
}

function normalizeWorldName(worldName: string): string {
  const trimmed = worldName.trim();
  return trimmed || "Untitled World";
}

function slugifyWorldName(input: string): string {
  const normalized = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "untitled-world";
}

function buildWorldPackageFileName(worldName: string, exportedAt: string): string {
  const stamp = exportedAt.replace(/[:.]/g, "-");
  return `skill-garden-${slugifyWorldName(worldName)}-${stamp}${WORLD_PACKAGE_EXTENSION}`;
}

function ensureIsoDate(value: string | undefined, fallback: string): string {
  if (!value) {
    return fallback;
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return new Date(parsed).toISOString();
}

function encodeAssetIdForPath(assetId: string): string {
  return assetId.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "uploaded-asset";
}

async function sha256HexFromBuffer(buffer: ArrayBuffer): Promise<string> {
  if (typeof crypto === "undefined" || typeof crypto.subtle === "undefined") {
    throw new Error("SHA-256 hashing is not available in this browser.");
  }

  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256HexFromBlob(blob: Blob): Promise<string> {
  return sha256HexFromBuffer(await blob.arrayBuffer());
}

function validateWorldPackageManifest(document: WorldPackageDocument): void {
  const assetIds = new Set<string>();
  const filePaths = new Set<string>();

  for (const asset of document.assets) {
    if (assetIds.has(asset.id)) {
      throw new Error(`World package contains duplicate asset id: ${asset.id}.`);
    }
    assetIds.add(asset.id);

    if (asset.kind === "uploaded") {
      if (filePaths.has(asset.file)) {
        throw new Error(`World package contains duplicate uploaded asset file path: ${asset.file}.`);
      }
      filePaths.add(asset.file);
    }
  }

  const missingManifestEntries = document.layout.objects
    .map((record) => record.assetId)
    .filter((assetId, index, values) => values.indexOf(assetId) === index)
    .filter((assetId) => !assetIds.has(assetId));
  if (missingManifestEntries.length > 0) {
    throw new Error(
      `World package is missing manifest entries for: ${missingManifestEntries.slice(0, 3).join(", ")}${
        missingManifestEntries.length > 3 ? ", ..." : ""
      }.`
    );
  }
}

function createVersionedLayoutJson(layoutRecords: BuilderLayoutRecord[], metadata?: BuilderWorldMetadata): string {
  const layoutMetadata = cloneBuilderWorldMetadata(metadata);
  return JSON.stringify(
    {
      version: 1,
      objects: layoutRecords,
      metadata: layoutMetadata
    },
    null,
    2
  );
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export function isWorldPackageFileName(fileName: string): boolean {
  const normalized = fileName.trim().toLowerCase();
  return normalized.endsWith(WORLD_PACKAGE_EXTENSION);
}

export async function createWorldPackageFile(input: CreateWorldPackageInput): Promise<CreateWorldPackageResult> {
  const now = new Date().toISOString();
  const worldName = normalizeWorldName(input.worldName);
  const exportedAt = ensureIsoDate(input.exportedAt, now);
  const exportedFromAppVersion = input.exportedFromAppVersion?.trim() || "unknown";
  const layoutRecords = input.layoutRecords.map((record) => ({
    ...record,
    position: { ...record.position }
  }));
  const layoutMetadata = cloneBuilderWorldMetadata(input.layoutMetadata);
  const builtInAssets = Array.from(new Map(input.builtInAssets.map((asset) => [asset.id, asset])).values());
  const uploadedAssets = Array.from(new Map(input.uploadedAssets.map((asset) => [asset.id, asset])).values());
  const assetEntries: WorldPackageDocument["assets"] = [];
  const zipEntries: Record<string, Uint8Array> = {};
  const builtInIdSet = new Set<string>();

  for (const asset of builtInAssets) {
    const normalizedId = asset.id.trim();
    if (!normalizedId) {
      continue;
    }

    builtInIdSet.add(normalizedId);
    assetEntries.push({
      kind: "built-in",
      id: normalizedId,
      label: asset.label.trim() || undefined
    });
  }

  for (const uploadedAsset of uploadedAssets) {
    const normalizedId = uploadedAsset.id.trim();
    if (!normalizedId) {
      throw new Error("Uploaded package assets must include an id.");
    }

    if (builtInIdSet.has(normalizedId)) {
      throw new Error(`Uploaded asset id collides with a built-in id: ${normalizedId}.`);
    }

    const normalizedFileName = uploadedAsset.fileName.trim();
    if (!normalizedFileName.toLowerCase().endsWith(".glb")) {
      throw new Error(`Uploaded package asset must be .glb: ${normalizedFileName || normalizedId}.`);
    }
    if (uploadedAsset.blob.size <= 0) {
      throw new Error(`Uploaded package asset is empty: ${normalizedFileName}.`);
    }

    const safePathStem = encodeAssetIdForPath(normalizedId);
    const filePath = `assets/${safePathStem}.glb`;
    const blobBuffer = await uploadedAsset.blob.arrayBuffer();
    const blobBytes = new Uint8Array(blobBuffer);
    const checksum = await sha256HexFromBuffer(blobBuffer);
    zipEntries[filePath] = blobBytes;
    assetEntries.push({
      kind: "uploaded",
      id: normalizedId,
      file: filePath,
      fileName: normalizedFileName,
      mimeType: uploadedAsset.mimeType.trim() || "model/gltf-binary",
      byteLength: uploadedAsset.blob.size,
      sha256: checksum,
      label: uploadedAsset.label.trim() || normalizedFileName.replace(/\.glb$/i, ""),
      category: uploadedAsset.category.trim() || "Uncategorized",
      uploadedAt: ensureIsoDate(uploadedAsset.uploadedAt, exportedAt),
      rotationY: uploadedAsset.rotationY,
      scale: uploadedAsset.scale > 0 ? uploadedAsset.scale : 1
    });
  }

  const document: WorldPackageDocument = {
    format: WORLD_PACKAGE_FORMAT,
    version: WORLD_PACKAGE_VERSION,
    metadata: {
      worldName,
      exportedAt,
      exportedFromAppVersion,
      objectCount: layoutRecords.length
    },
    layout: {
      version: 1,
      objects: layoutRecords,
      metadata: layoutMetadata
    },
    assets: assetEntries
  };
  validateWorldPackageManifest(document);
  zipEntries[WORLD_JSON_ENTRY_NAME] = strToU8(JSON.stringify(document, null, 2));

  const zipped = zipSync(zipEntries, { level: 6 });
  return {
    blob: new Blob([toArrayBuffer(zipped)], { type: "application/octet-stream" }),
    fileName: buildWorldPackageFileName(worldName, exportedAt),
    objectCount: layoutRecords.length,
    uploadedAssetCount: uploadedAssets.length
  };
}

async function parseWorldPackageBlob(blob: Blob): Promise<ParsedWorldPackage> {
  let zipEntries: Record<string, Uint8Array>;
  try {
    const data = new Uint8Array(await blob.arrayBuffer());
    zipEntries = unzipSync(data);
  } catch {
    throw new Error("World package could not be unzipped.");
  }

  const worldJsonBytes = zipEntries[WORLD_JSON_ENTRY_NAME];
  if (!worldJsonBytes) {
    throw new Error("World package is missing world.json.");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(strFromU8(worldJsonBytes));
  } catch {
    throw new Error("World package world.json could not be parsed.");
  }

  const parsedDocument = worldPackageDocumentSchema.safeParse(parsedJson);
  if (!parsedDocument.success) {
    throw new Error(parsedDocument.error.issues[0]?.message ?? "World package world.json is invalid.");
  }

  const document = parsedDocument.data;
  validateWorldPackageManifest(document);

  const uploadedAssets: ParsedWorldPackageUploadedAsset[] = [];
  for (const asset of document.assets) {
    if (asset.kind !== "uploaded") {
      continue;
    }

    const assetBytes = zipEntries[asset.file];
    if (!assetBytes) {
      throw new Error(`World package is missing uploaded asset payload: ${asset.file}.`);
    }

    if (assetBytes.byteLength !== asset.byteLength) {
      throw new Error(`World package uploaded asset size mismatch: ${asset.file}.`);
    }

    const payloadBlob = new Blob([toArrayBuffer(assetBytes)], { type: asset.mimeType || "model/gltf-binary" });
    const payloadHash = await sha256HexFromBlob(payloadBlob);
    if (payloadHash !== asset.sha256) {
      throw new Error(`World package uploaded asset checksum mismatch: ${asset.file}.`);
    }

    uploadedAssets.push({
      blob: payloadBlob,
      manifest: asset
    });
  }

  return {
    document,
    uploadedAssets
  };
}

export async function importWorldPackageFile(file: Blob): Promise<ImportWorldPackageResult> {
  const parsed = await parseWorldPackageBlob(file);
  const builtInAssetIds = new Set(getBuiltInAssetDefinitions().map((asset) => asset.id));
  const assetIdRemap = new Map<string, string>();
  let importedUploadedAssetCount = 0;
  let reusedUploadedAssetCount = 0;
  let remappedAssetCount = 0;

  for (const uploadedAsset of parsed.uploadedAssets) {
    const sourceId = uploadedAsset.manifest.id;
    let targetId = sourceId;

    if (builtInAssetIds.has(targetId)) {
      targetId = createUploadedAssetId();
      assetIdRemap.set(sourceId, targetId);
      remappedAssetCount += 1;
    }

    const existing = await getUploadedAssetSnapshot(targetId);
    if (existing) {
      const existingHash = await sha256HexFromBlob(existing.blob);
      if (existingHash === uploadedAsset.manifest.sha256) {
        reusedUploadedAssetCount += 1;
        continue;
      }

      targetId = createUploadedAssetId();
      assetIdRemap.set(sourceId, targetId);
      remappedAssetCount += 1;
    }

    await saveImportedUploadedAsset({
      blob: uploadedAsset.blob,
      category: uploadedAsset.manifest.category,
      createdAt: uploadedAsset.manifest.uploadedAt,
      fileName: uploadedAsset.manifest.fileName,
      id: targetId,
      label: uploadedAsset.manifest.label,
      mimeType: uploadedAsset.manifest.mimeType,
      rotationY: uploadedAsset.manifest.rotationY,
      scale: uploadedAsset.manifest.scale,
      updatedAt: uploadedAsset.manifest.uploadedAt
    });
    importedUploadedAssetCount += 1;
  }

  const layoutRecords = parsed.document.layout.objects.map((record) => ({
    ...record,
    assetId: assetIdRemap.get(record.assetId) ?? record.assetId,
    position: { ...record.position }
  }));

  return {
    importedUploadedAssetCount,
    layoutJson: createVersionedLayoutJson(layoutRecords, parsed.document.layout.metadata),
    layoutRecords,
    remappedAssetCount,
    reusedUploadedAssetCount,
    uploadedAssetCount: parsed.uploadedAssets.length,
    worldName: parsed.document.metadata.worldName
  };
}
