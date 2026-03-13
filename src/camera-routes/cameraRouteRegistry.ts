import type { CameraRouteDefinition } from "./cameraRouteTypes";
import {
  buildViewerProfileRoute,
  type BuildViewerProfileRouteOptions
} from "./routes/viewerRoutes";
import type { ViewerRoutePreset } from "./routes/viewerRoutes";
import { MENU_MAIN_ROUTE } from "./routes/menuRoutes";

export type CameraRouteContextKey = "menu/main";

const ROUTE_REGISTRY: Record<CameraRouteContextKey, CameraRouteDefinition> = {
  "menu/main": MENU_MAIN_ROUTE
};

export function resolveCameraRoute(context: CameraRouteContextKey): CameraRouteDefinition {
  return ROUTE_REGISTRY[context];
}

export function resolveViewerCinematicRoute(options: BuildViewerProfileRouteOptions): CameraRouteDefinition {
  return buildViewerProfileRoute(options);
}

export type ViewerCameraPresentationProfile = "default" | "ekaShowcase";

export interface ViewerWorldCameraRouteMetadata {
  defaultRouteId?: string;
  routes: CameraRouteDefinition[];
}

export type ViewerAutoplayRouteResolution =
  | {
      source: "world-metadata";
      route: CameraRouteDefinition;
      selectedRouteId: string;
    }
  | {
      source: "profile-fallback";
      preset: ViewerRoutePreset;
    }
  | {
      source: "none";
      reason: string;
    };

function isPlayableRoute(route: CameraRouteDefinition): boolean {
  return route.points.length >= 2;
}

function resolveWorldMetadataRoute(metadata: ViewerWorldCameraRouteMetadata | undefined): CameraRouteDefinition | null {
  if (!metadata || metadata.routes.length === 0) {
    return null;
  }

  if (metadata.defaultRouteId) {
    const defaultRoute = metadata.routes.find((route) => route.id === metadata.defaultRouteId);
    if (defaultRoute && isPlayableRoute(defaultRoute)) {
      return defaultRoute;
    }
  }

  return metadata.routes.find((route) => isPlayableRoute(route)) ?? null;
}

function resolveViewerRoutePreset(profile: ViewerCameraPresentationProfile): ViewerRoutePreset | null {
  if (profile === "ekaShowcase") {
    return "microSmallWorld";
  }

  if (profile === "default") {
    return "default";
  }

  return null;
}

export function resolveViewerAutoplayRoute(options: {
  profile: ViewerCameraPresentationProfile;
  worldCameraRoutes?: ViewerWorldCameraRouteMetadata;
}): ViewerAutoplayRouteResolution {
  const metadataRoute = resolveWorldMetadataRoute(options.worldCameraRoutes);
  if (metadataRoute) {
    return {
      source: "world-metadata",
      route: metadataRoute,
      selectedRouteId: metadataRoute.id
    };
  }

  const preset = resolveViewerRoutePreset(options.profile);
  if (!preset) {
    return {
      source: "none",
      reason: "no-profile-route"
    };
  }

  return {
    source: "profile-fallback",
    preset
  };
}
