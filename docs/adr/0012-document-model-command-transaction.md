# 12. Document model: command/transaction over a normalized store

Date: 2026-07-02

## Status

Accepted

## Context

With features built as plugins (ADR-0009), the token document is the shared surface every
extension touches — themes read/write `$extensions`, schema validates the tree, transforms
read it, token-ops mutate it. Sandboxed plugins (ADR-0010) cannot touch shared memory. The
model also has to stay compatible with undo/redo and the ADR-0004 merge base.

## Decision

The kernel owns a **normalized document** (tokens indexed by ID, the group tree, and
`$extensions`). Extensions mutate it **only via commands/transactions**; the kernel applies
them, emits change events on the bus, and derives undo/redo and the merge base from the
command log. **Sandboxed plugins receive immutable snapshots and return patches/commands**,
never direct references.

## Consequences

- Commands give clean, structured diffs — exactly what the ADR-0004 3-way merge and undo/redo
  need.
- The snapshot-in / patch-out contract is what makes the sandboxed tier (ADR-0010) possible.
- All document access is mediated, so the kernel can enforce validation, capabilities, and
  event emission uniformly.
