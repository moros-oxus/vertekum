# 4. Git-style two-way sync with 3-way merge

Date: 2026-07-02

## Status

Accepted

## Context

With a browser working copy and files that can each change independently (ADR-0003), we
needed a model for reconciling them. The working copy could be treated as the sole source
of truth, the file could be treated as authoritative, or the two could be treated as peers.
Detecting *which* side changed reliably is a three-way problem: comparing only the working
copy against an incoming file cannot distinguish a clean update from a genuine conflict.

## Decision

- **Git-style two-way sync.** The working copy and the files are **peers**, neither is
  inherently authoritative.
- **Stored merge base.** The app persists the **last-synced snapshot** per document as a
  merge base. On sync, both the working copy and the incoming file are diffed against the
  base, and each change is classified as a no-op, a fast-forward (only one side changed), or
  a true conflict (both sides changed the same thing).

## Consequences

- The app must persist a base snapshot per document alongside the working copy, and update
  it on every successful sync.
- Import is a **reconcile operation**, not an overwrite; the UI must surface fast-forwards
  and conflicts. (The conflict-resolution UX is deferred.)
- The merge operates per token, which depends on stable token identity — see ADR-0005 — and
  spans the whole document set — see ADR-0006.
