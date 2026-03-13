// Ensure core Babylon shader sources are registered in ShaderStore for SPA/dev-server environments.
// Without this preload, missing shader store entries can fall back to `/src/Shaders*.fx` fetches,
// which Vite resolves to HTML and causes shader compilation failures in WebGL/WebGPU.
import "@babylonjs/core/Shaders/default.vertex";
import "@babylonjs/core/Shaders/default.fragment";
import "@babylonjs/core/Shaders/pbr.vertex";
import "@babylonjs/core/Shaders/pbr.fragment";
import "@babylonjs/core/Shaders/openpbr.vertex";
import "@babylonjs/core/Shaders/openpbr.fragment";
import "@babylonjs/core/Shaders/pass.fragment";
import "@babylonjs/core/Shaders/rgbdDecode.fragment";
import "@babylonjs/core/ShadersWGSL/default.vertex";
import "@babylonjs/core/ShadersWGSL/default.fragment";
import "@babylonjs/core/ShadersWGSL/pbr.vertex";
import "@babylonjs/core/ShadersWGSL/pbr.fragment";
import "@babylonjs/core/ShadersWGSL/openpbr.vertex";
import "@babylonjs/core/ShadersWGSL/openpbr.fragment";
import "@babylonjs/core/ShadersWGSL/pass.fragment";
import "@babylonjs/core/ShadersWGSL/rgbdDecode.fragment";

export function registerCoreShaders(): void {
  // Side-effect imports above perform registration; this function is intentionally a no-op.
}
