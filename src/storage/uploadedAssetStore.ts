import { DEFAULT_UPLOADED_ASSET_CATEGORY, type AssetDefinition } from "../generation/natureKitAssetManifest";

const DATABASE_NAME = "skill-garden.uploaded-assets.v1";
const STORE_NAME = "uploaded-assets";
const UPLOAD_GROUP_ID = "uploads";
const UPLOAD_GROUP_LABEL = "Uploads";

interface UploadedAssetRecord {
  blob: Blob;
  category?: string;
  createdAt?: string;
  fileName: string;
  fileSize: number;
  id: string;
  label: string;
  mimeType: string;
  rotationY: number;
  scale: number;
  updatedAt?: string;
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || typeof window.indexedDB === "undefined") {
    return Promise.reject(new Error("Local asset uploads require IndexedDB support in this browser."));
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, 1);

    request.onerror = () => {
      reject(request.error ?? new Error("Uploaded asset storage could not be opened."));
    };

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

function withStore<T>(
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDatabase().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);
        const request = callback(store);

        request.onerror = () => {
          reject(request.error ?? new Error("Uploaded asset storage request failed."));
        };

        transaction.onabort = () => {
          reject(transaction.error ?? new Error("Uploaded asset storage transaction failed."));
        };

        transaction.oncomplete = () => {
          database.close();
        };

        request.onsuccess = () => {
          resolve(request.result);
        };
      })
  );
}

function generateUploadedAssetId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `local-uploaded:${crypto.randomUUID()}`;
  }

  return `local-uploaded:${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function titleCaseLabel(input: string): string {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.slice(0, 1).toUpperCase() + word.slice(1))
    .join(" ");
}

function createDefaultLabel(fileName: string): string {
  const baseName = fileName.replace(/\.glb$/i, "");
  const normalized = baseName.replace(/[_-]+/g, " ").trim();
  return titleCaseLabel(normalized || "Uploaded Asset");
}

function assertGlbFile(file: File): void {
  if (!file.name.toLowerCase().endsWith(".glb")) {
    throw new Error("Only .glb files are supported for local uploads.");
  }

  if (file.size <= 0) {
    throw new Error("The selected .glb file is empty.");
  }
}

function normalizeIsoTimestamp(value: string | undefined, fallback: string): string {
  if (!value) {
    return fallback;
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return new Date(parsed).toISOString();
}

function resolveRecordTimestamps(record: UploadedAssetRecord): { createdAt: string; updatedAt: string } {
  const epoch = new Date(0).toISOString();
  const updatedAt = normalizeIsoTimestamp(record.updatedAt, normalizeIsoTimestamp(record.createdAt, epoch));
  const createdAt = normalizeIsoTimestamp(record.createdAt, updatedAt);
  return { createdAt, updatedAt };
}

export function normalizeUploadedAssetCategory(input: string | null | undefined): string {
  const normalized = input?.trim();
  return normalized ? titleCaseLabel(normalized) : DEFAULT_UPLOADED_ASSET_CATEGORY;
}

function toAssetDefinition(record: UploadedAssetRecord): AssetDefinition {
  const { createdAt } = resolveRecordTimestamps(record);

  return {
    id: record.id,
    label: record.label,
    rotationY: record.rotationY,
    scale: record.scale,
    groupId: UPLOAD_GROUP_ID,
    groupLabel: UPLOAD_GROUP_LABEL,
    source: {
      type: "uploaded",
      category: normalizeUploadedAssetCategory(record.category),
      uploadedAt: createdAt
    }
  };
}

export async function listUploadedAssetDefinitions(): Promise<AssetDefinition[]> {
  const records = await withStore<UploadedAssetRecord[]>("readonly", (store) => store.getAll());
  return records
    .slice()
    .sort((left, right) => left.label.localeCompare(right.label))
    .map(toAssetDefinition);
}

export async function getUploadedAssetBlob(assetId: string): Promise<Blob | null> {
  const record = await withStore<UploadedAssetRecord | undefined>("readonly", (store) => store.get(assetId));
  return record?.blob ?? null;
}

export async function deleteUploadedAsset(assetId: string): Promise<boolean> {
  const record = await withStore<UploadedAssetRecord | undefined>("readonly", (store) => store.get(assetId));
  if (!record) {
    return false;
  }

  await withStore<undefined>("readwrite", (store) => store.delete(assetId));
  return true;
}

export async function clearUploadedAssets(): Promise<string[]> {
  const keys = await withStore<IDBValidKey[]>("readonly", (store) => store.getAllKeys());
  if (keys.length === 0) {
    return [];
  }

  await withStore<undefined>("readwrite", (store) => store.clear());
  return keys.map((key) => String(key));
}

export async function saveUploadedAsset(
  file: File,
  options?: {
    category?: string;
  }
): Promise<AssetDefinition> {
  assertGlbFile(file);

  const now = new Date().toISOString();
  const record: UploadedAssetRecord = {
    blob: file,
    category: normalizeUploadedAssetCategory(options?.category),
    createdAt: now,
    fileName: file.name,
    fileSize: file.size,
    id: generateUploadedAssetId(),
    label: createDefaultLabel(file.name),
    mimeType: file.type || "model/gltf-binary",
    rotationY: 0,
    scale: 1,
    updatedAt: now
  };

  await withStore<IDBValidKey>("readwrite", (store) => store.put(record));
  return toAssetDefinition(record);
}

export async function renameUploadedAssetCategory(
  assetId: string,
  nextCategory: string
): Promise<AssetDefinition | null> {
  const record = await withStore<UploadedAssetRecord | undefined>("readonly", (store) => store.get(assetId));
  if (!record) {
    return null;
  }

  const { createdAt } = resolveRecordTimestamps(record);
  const updatedRecord: UploadedAssetRecord = {
    ...record,
    category: normalizeUploadedAssetCategory(nextCategory),
    createdAt,
    updatedAt: new Date().toISOString()
  };
  await withStore<IDBValidKey>("readwrite", (store) => store.put(updatedRecord));
  return toAssetDefinition(updatedRecord);
}
