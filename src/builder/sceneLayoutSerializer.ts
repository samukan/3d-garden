import { z } from "zod";

import type { CameraRouteDefinition } from "../camera-routes/cameraRouteTypes";
import type {
  BuilderLayoutDocument,
  BuilderLayoutRecord,
  BuilderWorldMetadata
} from "./builderTypes";

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

const builderWorldCameraRoutesMetadataSchema = z.object({
  defaultRouteId: z.string().min(1).optional(),
  routes: z.array(cameraRouteSchema)
});

const builderWorldMetadataSchema = z.object({
  cameraRoutes: builderWorldCameraRoutesMetadataSchema.optional()
});

const builderLayoutDocumentSchema = z.object({
  objects: z.array(builderLayoutRecordSchema),
  metadata: builderWorldMetadataSchema.optional()
});

const versionedBuilderLayoutDocumentSchema = z.object({
  version: z.literal(1),
  objects: z.array(builderLayoutRecordSchema),
  metadata: builderWorldMetadataSchema.optional()
});

function cloneCameraRouteDefinition(route: CameraRouteDefinition): CameraRouteDefinition {
  const clonedTiming = route.timing.mode === "duration"
    ? {
        mode: "duration" as const,
        totalDurationMs: route.timing.totalDurationMs
      }
    : {
        mode: "speed" as const,
        unitsPerSecond: route.timing.unitsPerSecond
      };

  return {
    id: route.id,
    name: route.name,
    loop: route.loop,
    timing: clonedTiming,
    easing: route.easing,
    points: route.points.map((point) => ({
      position: [...point.position] as [number, number, number],
      lookAt: [...point.lookAt] as [number, number, number],
      dwellMs: point.dwellMs
    }))
  };
}

export function cloneBuilderWorldMetadata(metadata: BuilderWorldMetadata | undefined): BuilderWorldMetadata | undefined {
  const cameraRoutes = metadata?.cameraRoutes;
  if (!cameraRoutes) {
    return undefined;
  }

  return {
    cameraRoutes: {
      defaultRouteId: cameraRoutes.defaultRouteId,
      routes: cameraRoutes.routes.map(cloneCameraRouteDefinition)
    }
  };
}

function buildLayoutDocument(
  records: BuilderLayoutRecord[],
  metadata?: BuilderWorldMetadata,
  version?: 1
): BuilderLayoutDocument {
  const nextMetadata = cloneBuilderWorldMetadata(metadata);

  return {
    version,
    objects: records,
    metadata: nextMetadata
  };
}

export function serializeBuilderLayout(records: BuilderLayoutRecord[], metadata?: BuilderWorldMetadata): string {
  return JSON.stringify(
    buildLayoutDocument(records, metadata, undefined),
    null,
    2
  );
}

export function serializeVersionedBuilderLayout(records: BuilderLayoutRecord[], metadata?: BuilderWorldMetadata): string {
  return JSON.stringify(
    buildLayoutDocument(records, metadata, 1),
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

  const versionedResult = versionedBuilderLayoutDocumentSchema.safeParse(parsedJson);
  const result = versionedResult.success
    ? versionedResult
    : builderLayoutDocumentSchema.safeParse(parsedJson);

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

  const metadata = cloneBuilderWorldMetadata(result.data.metadata);
  const version = "version" in result.data && result.data.version === 1 ? 1 : undefined;

  return {
    success: true,
    value: buildLayoutDocument(result.data.objects, metadata, version)
  };
}
