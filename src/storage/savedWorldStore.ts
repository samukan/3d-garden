import { z } from "zod";

import { parseBuilderLayoutDocument } from "../builder/sceneLayoutSerializer";
import type { SavedWorldRecord, SavedWorldSummary } from "../builder/builderTypes";

const STORAGE_KEY = "skill-garden.saved-worlds.v1";
let pendingStoreNotice: string | null = null;

const savedWorldRecordSchema = z.object({
  createdAt: z.string().min(1),
  id: z.string().min(1),
  layout: z.string().min(1),
  name: z.string().min(1),
  objectCount: z.number().int().nonnegative(),
  updatedAt: z.string().min(1)
});

const savedWorldStoreSchema = z.array(savedWorldRecordSchema);

function setStoreNotice(message: string): void {
  pendingStoreNotice = message;
}

function getStorage(): Storage | null {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    setStoreNotice("Saved worlds are not available in this browser session.");
    return null;
  }

  return window.localStorage;
}

function generateWorldId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `world-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeWorldName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("World name is required.");
  }

  return trimmed.slice(0, 80);
}

function readSavedWorldStore(): SavedWorldRecord[] {
  const storage = getStorage();
  if (!storage) {
    return [];
  }

  const rawValue = storage.getItem(STORAGE_KEY);
  if (!rawValue) {
    return [];
  }

  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(rawValue);
  } catch {
    storage.removeItem(STORAGE_KEY);
    setStoreNotice("Saved worlds data was corrupted and has been reset.");
    return [];
  }

  const result = savedWorldStoreSchema.safeParse(parsedJson);
  if (!result.success) {
    storage.removeItem(STORAGE_KEY);
    setStoreNotice("Saved worlds data was invalid and has been reset.");
    return [];
  }

  return result.data;
}

function writeSavedWorldStore(records: SavedWorldRecord[]): void {
  const storage = getStorage();
  if (!storage) {
    throw new Error("Saved worlds are not available in this browser session.");
  }

  storage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function validateLayout(layout: string): number {
  const result = parseBuilderLayoutDocument(layout);
  if (!result.success) {
    throw new Error(result.error);
  }

  return result.value.objects.length;
}

function toSummary(record: SavedWorldRecord): SavedWorldSummary {
  return {
    createdAt: record.createdAt,
    id: record.id,
    name: record.name,
    objectCount: record.objectCount,
    updatedAt: record.updatedAt
  };
}

export function listSavedWorlds(): SavedWorldSummary[] {
  return readSavedWorldStore()
    .map(toSummary)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function getSavedWorld(worldId: string): SavedWorldRecord | null {
  const records = readSavedWorldStore();
  return records.find((record) => record.id === worldId) ?? null;
}

export function saveSavedWorld(input: {
  layout: string;
  name: string;
  worldId?: string | null;
}): SavedWorldRecord {
  const records = readSavedWorldStore();
  const now = new Date().toISOString();
  const name = normalizeWorldName(input.name);
  const objectCount = validateLayout(input.layout);
  const existingIndex = input.worldId ? records.findIndex((record) => record.id === input.worldId) : -1;

  if (existingIndex >= 0) {
    const existingRecord = records[existingIndex];
    const updatedRecord: SavedWorldRecord = {
      ...existingRecord,
      layout: input.layout,
      name,
      objectCount,
      updatedAt: now
    };

    records[existingIndex] = updatedRecord;
    writeSavedWorldStore(records);
    return updatedRecord;
  }

  const createdRecord: SavedWorldRecord = {
    createdAt: now,
    id: generateWorldId(),
    layout: input.layout,
    name,
    objectCount,
    updatedAt: now
  };

  records.push(createdRecord);
  writeSavedWorldStore(records);
  return createdRecord;
}

export function deleteSavedWorld(worldId: string): boolean {
  const records = readSavedWorldStore();
  const nextRecords = records.filter((record) => record.id !== worldId);
  if (nextRecords.length === records.length) {
    return false;
  }

  writeSavedWorldStore(nextRecords);
  return true;
}

export function consumeSavedWorldStoreNotice(): string | null {
  const notice = pendingStoreNotice;
  pendingStoreNotice = null;
  return notice;
}
