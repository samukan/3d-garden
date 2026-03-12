import { z } from "zod";

export interface ViewerDraftRecord {
  id: string;
  name: string;
  layout: string;
  objectCount: number;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "skill-garden.viewer-drafts.v1";

const viewerDraftRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  layout: z.string().min(1),
  objectCount: z.number().int().nonnegative(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

const viewerDraftStoreSchema = z.array(viewerDraftRecordSchema);

function getStorage(): Storage | null {
  if (typeof window === "undefined" || typeof window.sessionStorage === "undefined") {
    return null;
  }

  return window.sessionStorage;
}

function generateDraftId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `viewer-json:${crypto.randomUUID()}`;
  }

  return `viewer-json:${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readStore(): ViewerDraftRecord[] {
  const storage = getStorage();
  if (!storage) {
    return [];
  }

  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    storage.removeItem(STORAGE_KEY);
    return [];
  }

  const result = viewerDraftStoreSchema.safeParse(parsed);
  if (!result.success) {
    storage.removeItem(STORAGE_KEY);
    return [];
  }

  return result.data;
}

function writeStore(records: ViewerDraftRecord[]): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function normalizeName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return "Imported World";
  }

  return trimmed.slice(0, 80);
}

export function saveViewerDraft(input: {
  layout: string;
  name: string;
  objectCount: number;
}): ViewerDraftRecord {
  const records = readStore();
  const now = new Date().toISOString();
  const record: ViewerDraftRecord = {
    id: generateDraftId(),
    name: normalizeName(input.name),
    layout: input.layout,
    objectCount: input.objectCount,
    createdAt: now,
    updatedAt: now
  };

  // Keep this lightweight and session-scoped: most recent drafts first.
  const nextRecords = [record, ...records].slice(0, 10);
  writeStore(nextRecords);
  return record;
}

export function getViewerDraft(draftId: string): ViewerDraftRecord | null {
  const records = readStore();
  return records.find((record) => record.id === draftId) ?? null;
}
