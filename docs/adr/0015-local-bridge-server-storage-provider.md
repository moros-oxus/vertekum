# 15. Local Node bridge server as the default local StorageProvider

Date: 2026-07-02

## Status

Accepted — amends ADR-0007 and ADR-0008

## Context

Browser-only local storage has friction: the File System Access API needs a permission
re-grant after every reload and is Chromium-only, and remote git from the browser needs a
CORS proxy (ADR-0008). Meanwhile, the local run scenarios (S1 embedded, S2 dedicated repo)
**already run a local Node process** to serve the app, so a filesystem/git helper there is
not new infrastructure — this is the Storybook / Vite / local-CMS pattern.

## Decision

Ship a **`LocalServerProvider`**: a thin local Node process that exposes filesystem and git
access to the browser SPA, behind the ADR-0008 `StorageProvider` interface. It is the
**default storage path for local run modes** (S1, S2, S3-container).

This is **not a hosted backend** — it is a single-user localhost helper the user runs on
their own machine (no hosting, no accounts, no multi-user state). ADR-0007's "no backend" is
refined to **"no hosted/remote backend; a local helper process is allowed for local run
modes."** Pure-static contexts (S3 git-pages, S4) have no such process and fall back to the
browser FSA / host-API providers (ADR-0008).

## Consequences

- Dissolves, for local work, both the FSA permission/Chromium limitation and the remote-git
  CORS-proxy dependency — the server touches the filesystem and makes git network calls;
  the browser only talks to `localhost`.
- Document entry for local runs becomes "the server is pointed at the collection directory"
  (Storybook-style) — no folder-picker (see ADR-0007 scenarios).
- The app supports both storage paths behind one interface, selected by run context.

## Amendment (2026-07-08): dual-root

The bridge is **dual-root**. `/api/collection` serves the **token collection dir**; `/api/file`
and `/api/settings` serve the **project dir** (`dirname(configPath)` — where `vertekum.config`
lives). So the config store (`.vertekum/settings.json`), the release lock
(`.vertekum/release.lock.json`), the changelog, and generated export outputs all sit **at the
project root, sibling to `vertekum.config`** — not inside the token source. `.vertekum/settings.json`
is per-user (git-ignored); the release lock + changelog are git-tracked. `createBridgeServer(collectionDir, projectDir=collectionDir)`; the CLI passes both.

## Amendment (2026-07-25): git surface

The bridge exposes a small read-only **git** surface for the git ReleaseProvider (all via local
`git`, `cwd` = the project dir): `GET /api/git/latest-release` (the highest `v*` version tag — the
release baseline) and `GET /api/git/collection?ref=<tag>` (the token collection as it was at that
ref). A single write endpoint, `POST /api/git/release`, performs the **opt-in** release actions
(`commit` / `tag` / `bumpPackage`) at HEAD; with no toggles enabled it is never called (the provider
writes only the changelog via `/api/file`). This is the "makes git network/local calls" mode noted
above, scoped to local history operations — no push.
