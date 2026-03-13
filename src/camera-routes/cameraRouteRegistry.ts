import type { CameraRouteDefinition } from "./cameraRouteTypes";
import { MENU_MAIN_ROUTE } from "./routes/menuRoutes";

export type CameraRouteContextKey = "menu/main";

const ROUTE_REGISTRY: Record<CameraRouteContextKey, CameraRouteDefinition> = {
  "menu/main": MENU_MAIN_ROUTE
};

export function resolveCameraRoute(context: CameraRouteContextKey): CameraRouteDefinition {
  return ROUTE_REGISTRY[context];
}
