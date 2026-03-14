export type AppMode = "menu" | "builder" | "viewer";
export type BuilderShellMode = "v1" | "v2";

export interface AppRoute {
  mode: AppMode;
  builderShell: BuilderShellMode;
  notice: string | null;
  worldId: string | null;
  worldJsonId: string | null;
}

const persistentQueryKeys = ["builderShell", "debugBrowserLogs", "renderer"] as const;

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

function sanitizeWorldJsonId(worldJsonId: string | undefined): string | null {
  const trimmed = worldJsonId?.trim();
  return trimmed ? trimmed : null;
}

function parseBuilderShellMode(shell: string | undefined): BuilderShellMode | null {
  if (shell === "v1" || shell === "v2") {
    return shell;
  }

  return null;
}

function resolveAppRoute(): AppRoute {
  if (typeof window !== "undefined") {
    const searchParams = new URLSearchParams(window.location.search);
    const appModeParam = searchParams.get("appMode") ?? undefined;
    const builderShellParam = searchParams.get("builderShell") ?? undefined;
    const queryMode = parseAppMode(appModeParam);
    const queryBuilderShell = parseBuilderShellMode(builderShellParam);

    if (queryMode) {
      return {
        mode: queryMode,
        builderShell: queryBuilderShell ?? parseBuilderShellMode(import.meta.env.VITE_BUILDER_SHELL) ?? "v1",
        notice: sanitizeNotice(searchParams.get("notice") ?? undefined),
        worldId: sanitizeWorldId(searchParams.get("worldId") ?? undefined),
        worldJsonId: sanitizeWorldJsonId(searchParams.get("worldJsonId") ?? undefined)
      };
    }
  }

  return {
    mode: parseAppMode(import.meta.env.VITE_APP_MODE) ?? "menu",
    builderShell: parseBuilderShellMode(import.meta.env.VITE_BUILDER_SHELL) ?? "v1",
    notice: null,
    worldId: null,
    worldJsonId: null
  };
}

export const activeAppRoute = resolveAppRoute();
export const activeAppMode = activeAppRoute.mode;

export function buildAppHref(route: {
  mode: AppMode;
  builderShell?: BuilderShellMode;
  notice?: string | null;
  worldId?: string | null;
  worldJsonId?: string | null;
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

  if (route.builderShell) {
    params.set("builderShell", route.builderShell);
  }

  if (route.worldId) {
    params.set("worldId", route.worldId);
  } else if (route.worldJsonId) {
    params.set("worldJsonId", route.worldJsonId);
  }

  const notice = sanitizeNotice(route.notice ?? undefined);
  if (notice) {
    params.set("notice", notice);
  }

  return `?${params.toString()}`;
}

export function navigateToRoute(route: {
  mode: AppMode;
  builderShell?: BuilderShellMode;
  notice?: string | null;
  worldId?: string | null;
  worldJsonId?: string | null;
}): void {
  if (typeof window === "undefined") {
    return;
  }

  window.location.assign(buildAppHref(route));
}

export function isBuilderMode(): boolean {
  return activeAppMode === "builder";
}
