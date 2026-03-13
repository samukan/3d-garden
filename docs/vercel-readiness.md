# Vercel Readiness Audit (First Presentation Version)

## Summary

The current app is suitable for static Vercel hosting as a Vite SPA, with important local-first caveats documented below.

## Readiness Table

| Area | Status | Evidence from repo | Action before presentation |
| --- | --- | --- | --- |
| Build command | Ready | `npm run build` succeeds | Use `npm run build` in Vercel |
| Output directory | Ready | Vite outputs `dist/` | Set output to `dist` |
| Vite compatibility | Ready | Client-side SPA builds cleanly | No framework migration needed |
| Public assets | Ready with caveat | Built-in GLBs under `/public/assets/...` are available | Keep manifest in sync with tracked assets |
| Browser-only assumptions | Ready with caveat | localStorage/sessionStorage/IndexedDB are used by design | Document per-browser/per-origin behavior |
| Query-param routing | Ready | `?appMode`, `?worldId`, `?worldJsonId`, `?renderer` are supported | Root static hosting is sufficient |
| Builder/viewer safety | Ready with caveat | No backend dependency for core flows | Document portability limits for uploaded assets |
| Production confidence | Mostly ready | Browser regression command passes in repo baseline | Perform live-deployment smoke checks |
| Performance | Risk to monitor | Production build warns about large JS chunk size | Accept for v1, optimize in roadmap |

## Key Deployment Risks

- High: world files that rely on uploaded local asset IDs are not portable to fresh browsers.
- High: local persistence does not transfer automatically across devices, browsers, or domains.
- Medium: first-load performance may vary due to bundle size and asset loading.
- Medium: WebGPU availability varies by browser/device; WebGL fallback behavior can differ.
- Medium: automated tests run against Vite dev server, so live Vercel smoke validation is still required.

## Recommended Vercel Settings

- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: `dist`
- Framework preset: `Vite`

## Live Verification Targets

- `/?appMode=menu`
- `/?appMode=builder`
- `/?appMode=viewer&worldId=<existing-local-world-id>` (local data required)
- `/?renderer=webgl&appMode=menu`

## Notes on Data Scope

- Saved worlds and uploads are local-first by design.
- A Vercel deploy is functional without a backend, but user-created data remains browser-origin scoped.
