/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_APP_MODE?: "menu" | "builder" | "viewer";
	readonly VITE_DEBUG_BROWSER_LOGS?: string;
	readonly VITE_RENDERER?: "auto" | "webgl" | "webgpu";
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
