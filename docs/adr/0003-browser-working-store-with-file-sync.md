# 3. Browser working store with explicit file sync

Date: 2026-07-02

## Status

Accepted — amended by ADR-0008 (the sync target is a pluggable StorageProvider; git preferred)

## Context

Given a local-first browser SPA (ADR-0001), the token data has to live somewhere. Options
included: the File System Access API (persistent file/folder handles, Chromium-only),
import/export only (no persistence between sessions), or a browser-local working store with
explicit file sync.

## Decision

The live document is a **working copy** held in a browser store (**IndexedDB / OPFS**).
DTCG files are **synced explicitly** — imported to seed or update the working copy, exported
to publish it. The working copy is the in-session live state; files are the interchange
artifact.

## Consequences

- The document survives page reloads without requiring a filesystem handle, so the app
  works across browsers regardless of File System Access API support.
- The working copy and the files can diverge, which necessitates a defined reconcile model
  — see ADR-0004 (git-style two-way sync).
- Nothing is written to disk automatically; the user controls when the working copy is
  synced to files.
