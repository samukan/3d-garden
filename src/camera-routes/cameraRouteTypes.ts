export type CameraRoutePointVector = [number, number, number];

export interface CameraRoutePoint {
  position: CameraRoutePointVector;
  lookAt: CameraRoutePointVector;
  dwellMs?: number;
}

export type CameraRouteTiming =
  | { mode: "duration"; totalDurationMs: number }
  | { mode: "speed"; unitsPerSecond: number };

export type CameraRouteEasing = "linear" | "easeInOutSine";

export interface CameraRouteDefinition {
  id: string;
  name: string;
  loop: boolean;
  timing: CameraRouteTiming;
  easing?: CameraRouteEasing;
  points: CameraRoutePoint[];
}

export interface CameraRoutePlayOptions {
  restart?: boolean;
}

export interface CameraRouteStopOptions {
  resetToStart?: boolean;
}
