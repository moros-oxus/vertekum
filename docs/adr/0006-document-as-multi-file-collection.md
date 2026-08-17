# 6. A document is a multi-file collection

Date: 2026-07-02

## Status

Accepted

## Context

The working copy, merge base, and sync (ADR-0003, ADR-0004) all operate on some unit. Real
design-token systems usually span multiple DTCG files (e.g. core vs. semantic, per-theme
files), and DTCG explicitly supports splitting tokens across files. We had to decide whether
Vertekum's unit is a single file or a collection.

## Decision

A **document is a multi-file collection (a folder) of DTCG files**, loaded, synced, and
merged as one unit. The merge base and the 3-way merge (ADR-0004) span the whole set, with
changes keyed by **file + token ID** (ADR-0005).

## Consequences

- Import/export operate on a folder of files, not a single file.
- The merge base is a snapshot of the entire collection, so moves of a token between files
  within the collection are visible to the merge (tracked by token ID).
- A single logical token system is one document, rather than several independently opened
  files.
