# Skill Garden Storage and World Formats (Current State)

This document explains browser-local persistence layers and practical file-format behavior.

## 1) Storage Layers

Skill Garden is local-first and uses three browser storage layers.

### Saved Worlds (localStorage)

Purpose:

- Persistent named worlds for menu/builder/viewer roundtrips.

Implementation:

- Storage key: `skill-garden.saved-worlds.v1`
- Module: `src/storage/savedWorldStore.ts`

Behavior highlights:

- Save creates/updates world records with timestamps and object counts.
- Layout JSON is validated before persistence.
- Corrupted/invalid store content is reset safely.

### Viewer Drafts (sessionStorage)

Purpose:

- Temporary viewer-open records for imported JSON/SGW files.

Implementation:

- Storage key: `skill-garden.viewer-drafts.v1`
- Module: `src/storage/viewerDraftStore.ts`

Behavior highlights:

- Session-scoped drafts (not long-term persistence).
- Stores most recent entries up to a small capped list.
- Used by menu “open in viewer” flows.

### Uploaded Assets (IndexedDB)

Purpose:

- Persistent uploaded `.glb` binary payloads and metadata.

Implementation:

- Database: `skill-garden.uploaded-assets.v1`
- Object store: `uploaded-assets`
- Module: `src/storage/uploadedAssetStore.ts`

Behavior highlights:

- Only `.glb` uploads are accepted.
- Stores blob + metadata (label, category, transform defaults, timestamps).
- Exposes listing/snapshot/read/delete/rename-category operations.

## 2) World Format Overview

Skill Garden currently supports two world file formats:

- Legacy layout JSON (`.json`)
- Portable world package (`.sgw`)

### `.json` (legacy layout format)

Use when:

- you need layout-level import/export workflows
- you do not require uploaded-asset payload portability

Important constraint:

- JSON layout does not embed uploaded `.glb` binary payloads.
- If a layout references uploaded local asset IDs not present in the current browser data, viewer load may skip those objects.

### `.sgw` (recommended portable package)

Use when:

- you need practical portability across environments/devices
- worlds include uploaded local assets

Implementation:

- Module: `src/world-package/worldPackageIO.ts`
- Package format id: `skill-garden.world-package`
- Package version: `1`

Package contents include:

- world layout JSON (versioned)
- world metadata (including camera-route metadata when present)
- uploaded `.glb` payload files and manifest entries

Import behavior highlights:

- validates package structure and asset manifest
- verifies uploaded payload hashes (SHA-256)
- reuses already-known uploaded assets when possible
- remaps conflicting uploaded asset IDs when needed

## 3) Storage + Format Relationship

Practical model:

1. Builder saves worlds to localStorage.
2. Uploaded local assets live in IndexedDB.
3. Viewer-draft flow uses sessionStorage for immediate viewing of imported files.
4. SGW export packages layout + uploaded payloads for portability.

## 4) Portability Rules (Practical)

- Best portability: use `.sgw`.
- Legacy layout sharing/debugging: `.json`.
- URL route ids (`worldId`, `worldJsonId`) are environment-local and depend on matching local data.

## 5) Current Limitations (Storage/Formats)

- No cloud persistence or multi-user synchronization.
- Browser storage is origin-scoped.
- Legacy `.json` is not a full uploaded-asset portability format.
- Uploaded asset lifecycle is local data management, not centralized asset hosting.

## 6) Source Modules

- `src/storage/savedWorldStore.ts`
- `src/storage/viewerDraftStore.ts`
- `src/storage/uploadedAssetStore.ts`
- `src/world-package/worldPackageIO.ts`
- `src/builder/sceneLayoutSerializer.ts`
