export type AppMode = "menu" | "builder" | "viewer";

export interface AppRoute {
  mode: AppMode;
  notice: string | null;
  worldId: string | null;
}

const persistentQueryKeys = ["debugBrowserLogs", "renderer"] as const;

function parseAppMode(mode: string | undefined): AppMode | null {
  if (mode === "menu" || mode === "builder" || mode === "viewer") {
    return mode;
  }

  return null;
}

function sanitizeWorldId(worldId: string | undefined): string | null {
  const trimmed = worldId?.trim();
  return trimmed ? trimmed : null;
}

function sanitizeNotice(notice: string | undefined): string | null {
  const trimmed = notice?.trim();
  return trimmed ? trimmed : null;
}

function resolveAppRoute(): AppRoute {
  if (typeof window !== "undefined") {
    const searchParams = new URLSearchParams(window.location.search);
    const appModeParam = searchParams.get("appMode") ?? undefined;
    const queryMode = parseAppMode(appModeParam);

    if (queryMode) {
      return {
        mode: queryMode,
        notice: sanitizeNotice(searchParams.get("notice") ?? undefined),
        worldId: sanitizeWorldId(searchParams.get("worldId") ?? undefined)
      };
    }
  }

  return {
    mode: parseAppMode(import.meta.env.VITE_APP_MODE) ?? "menu",
    notice: null,
    worldId: null
  };
}

export const activeAppRoute = resolveAppRoute();
export const activeAppMode = activeAppRoute.mode;

export function buildAppHref(route: {
  mode: AppMode;
  notice?: string | null;
  worldId?: string | null;
}): string {
  const params = new URLSearchParams();

  if (typeof window !== "undefined") {
    const currentParams = new URLSearchParams(window.location.search);
    for (const key of persistentQueryKeys) {
      const value = currentParams.get(key);
      if (value) {
        params.set(key, value);
      }
    }
  }

  params.set("appMode", route.mode);

  if (route.worldId) {
    params.set("worldId", route.worldId);
  }

  const notice = sanitizeNotice(route.notice ?? undefined);
  if (notice) {
    params.set("notice", notice);
  }

  return `?${params.toString()}`;
}

export function navigateToRoute(route: {
  mode: AppMode;
  notice?: string | null;
  worldId?: string | null;
}): void {
  if (typeof window === "undefined") {
    return;
  }

  window.location.assign(buildAppHref(route));
}

export function isBuilderMode(): boolean {
  return activeAppMode === "builder";
}