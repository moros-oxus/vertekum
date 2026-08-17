# 1. vtk-app is a local-first browser SPA

Date: 2026-07-02

## Status

Accepted — amended by ADR-0007 (deployment model, run modes, and client-side git-host auth)

## Context

Vertekum's management tool (`vtk-app`) lets users create, modify, and curate design
tokens and themes, and export them to downstream consumers. We had to decide the runtime
shape of the app: a browser SPA, a desktop app (Electron/Tauri), a web app with a backend,
or a CLI/library. The monorepo has no backend package, and the README frames the tool as a
local authoring/curation surface over DTCG token files.

## Decision

`vtk-app` is a **local-first, client-side browser SPA**. There is no server, no database,
and no user accounts. Token data lives with the user (see ADR-0003); the app's primary I/O
is importing and exporting files.

## Consequences

- No accounts, authentication, or multi-user collaboration in the product. Collaboration,
  if ever needed, happens out-of-band (e.g. via the files under version control).
- Import/export is the primary I/O surface, which makes the persistence and sync model
  (ADR-0003, ADR-0004) central to the architecture rather than incidental.
- Adding a backend later would be a significant architectural change, reversing this ADR.
