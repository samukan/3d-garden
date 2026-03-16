# Development and Testing Quick Reference

This is the practical run/build/test guide for current project workflows.

## 1) Local Development

Install dependencies:

```bash
npm install
```

Run dev server:

```bash
npm run dev
```

Useful mode URLs while dev server is running:

- `?appMode=menu`
- `?appMode=builder`
- `?appMode=builder&builderShell=v2`
- `?appMode=viewer&worldId=<saved-world-id>`

## 2) Build and Typecheck

Typecheck:

```bash
npm run typecheck
```

Production build:

```bash
npm run build
```

Preview built output:

```bash
npm run preview
```

## 3) Playwright Usage

Install Chromium once per environment:

```bash
npm run playwright:install
```

Run default browser harness (headless):

```bash
npm run debug:browser
```

Run visible browser harness (headed):

```bash
npm run debug:browser:headed
```

Harness notes (from current config):

- Uses `playwright.debug.config.ts`.
- Starts Vite automatically at `127.0.0.1:4173`.
- Uses deterministic env defaults (`VITE_APP_MODE=menu`, `VITE_RENDERER=webgl`).
- Captures browser logs/errors for debugging.

## 4) Smoke vs E2E (When to Run What)

Folder split:

- Smoke: `playwright/smoke/*`
- E2E: `playwright/e2e/**/*`

Recommended usage:

- Fast confidence check before small changes: run smoke-only.
- Regression checks for workflow/storage/import/export changes: run full suite or targeted e2e.

Examples:

```bash
npx playwright test -c playwright.debug.config.ts playwright/smoke
npx playwright test -c playwright.debug.config.ts playwright/e2e/world-flows/save-view-edit.spec.ts
```

## 5) Manual QA Checklist (Short)

Run this after meaningful builder/viewer changes:

1. Menu -> New Builder world -> place object -> save.
2. Return to menu -> open saved world in viewer.
3. In viewer, verify load status and reset view behavior.
4. In builder, export and re-import a JSON layout; verify object count parity.
5. Export and re-import an SGW package for a world with uploaded assets; verify assets resolve.
6. Open builder with `builderShell=v2`; verify shell loads and core editing still works.

## 6) Current Testing Limits / Gaps

- Browser tests rely on deterministic WebGL harness settings and may not reveal all renderer-specific issues.
- CI runs `npm run debug:browser`; keep this command healthy as the primary automated browser gate.
- Manual QA is still required for UX-level confidence, especially for transitional shell behavior (`v1` vs `v2`).
