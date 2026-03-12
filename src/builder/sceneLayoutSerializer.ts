import { z } from "zod";

import type { BuilderLayoutDocument, BuilderLayoutRecord } from "./builderTypes";

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

const builderLayoutDocumentSchema = z.object({
  objects: z.array(builderLayoutRecordSchema)
});

const versionedBuilderLayoutDocumentSchema = z.object({
  version: z.literal(1),
  objects: z.array(builderLayoutRecordSchema)
});

export function serializeBuilderLayout(records: BuilderLayoutRecord[]): string {
  return JSON.stringify(
    {
      objects: records
    },
    null,
    2
  );
}

export function serializeVersionedBuilderLayout(records: BuilderLayoutRecord[]): string {
  return JSON.stringify(
    {
      version: 1,
      objects: records
    },
    null,
    2
  );
}

export function parseBuilderLayoutDocument(input: string):
  | { success: true; value: BuilderLayoutDocument }
  | { success: false; error: string } {
  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(input);
  } catch {
    return {
      success: false,
      error: "Layout JSON could not be parsed."
    };
  }

  const legacyResult = builderLayoutDocumentSchema.safeParse(parsedJson);
  const result = legacyResult.success
    ? legacyResult
    : versionedBuilderLayoutDocumentSchema.safeParse(parsedJson);

  if (!result.success) {
    return {
      success: false,
      error: result.error.issues[0]?.message ?? "Layout JSON is invalid."
    };
  }

  const ids = new Set<string>();
  for (const record of result.data.objects) {
    if (ids.has(record.id)) {
      return {
        success: false,
        error: `Layout contains a duplicate id: ${record.id}`
      };
    }

    ids.add(record.id);
  }

  return {
    success: true,
    value: {
      objects: result.data.objects
    }
  };
}
