import type { AppRoute } from "../appMode";
import { parseBuilderLayoutDocument } from "../builder/sceneLayoutSerializer";
import { getSavedWorld } from "../storage/savedWorldStore";
import { getViewerDraft } from "../storage/viewerDraftStore";
import type { ViewerWorldDocument, ViewerWorldResolution } from "./viewerTypes";

function resolveSavedWorld(worldId: string): ViewerWorldResolution {
  const savedWorld = getSavedWorld(worldId);
  if (!savedWorld) {
    return {
      success: false,
      error: "That saved world could not be found."
    };
  }

  const parsed = parseBuilderLayoutDocument(savedWorld.layout);
  if (!parsed.success) {
    return {
      success: false,
      error: `Saved world could not be opened: ${parsed.error}`
    };
  }

  const world: ViewerWorldDocument = {
    source: "saved-world",
    sourceId: savedWorld.id,
    name: savedWorld.name,
    layoutRecords: parsed.value.objects,
    objectCount: parsed.value.objects.length,
    updatedAt: savedWorld.updatedAt,
    editableWorldId: savedWorld.id
  };

  return {
    success: true,
    world
  };
}

function resolveDraftWorld(worldJsonId: string): ViewerWorldResolution {
  const draft = getViewerDraft(worldJsonId);
  if (!draft) {
    return {
      success: false,
      error: "That imported world is no longer available. Reopen the JSON file from the menu."
    };
  }

  const parsed = parseBuilderLayoutDocument(draft.layout);
  if (!parsed.success) {
    return {
      success: false,
      error: `Imported world could not be opened: ${parsed.error}`
    };
  }

  const world: ViewerWorldDocument = {
    source: "json-file",
    sourceId: draft.id,
    name: draft.name,
    layoutRecords: parsed.value.objects,
    objectCount: parsed.value.objects.length,
    updatedAt: draft.updatedAt,
    editableWorldId: null
  };

  return {
    success: true,
    world
  };
}

export function resolveViewerWorld(route: AppRoute): ViewerWorldResolution {
  if (route.worldId) {
    return resolveSavedWorld(route.worldId);
  }

  if (route.worldJsonId) {
    return resolveDraftWorld(route.worldJsonId);
  }

  return {
    success: false,
    error: "No world was provided to the viewer."
  };
}
