# 19. Unified Sync with progressive disclosure

Date: 2026-07-02

## Status

Accepted

## Context

Git is the substrate (ADR-0004, ADR-0008), but a stated goal is to *ease* token management
for people who aren't git-fluent (designers), while still giving developers control.

## Decision

A single primary **Sync** action reconciles the working copy ↔ files ↔ git — write working
copy to files → commit → pull + **3-way merge** (ADR-0004) → push — surfacing fast-forward
vs. **conflict only when it arises**. Git-native controls remain available underneath for
power users (**progressive disclosure**), but are not required.

## Consequences

- Non-git users get a one-click reconcile; developers keep control.
- The walking skeleton degenerates this to **write-through + a dirty-state indicator** (local
  files, single-user, no remote); the conflict-resolution UI is designed-for but deferred.
- Working-copy dirty state is tracked relative to the last sync (the merge base, ADR-0004).
