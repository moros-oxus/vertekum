# 5. Token identity via stable IDs in $extensions

Date: 2026-07-02

## Status

Accepted

## Context

The 3-way merge (ADR-0004) operates at token granularity, so it needs a way to identify
"the same token" on both sides of a merge. DTCG files are keyed by a token's path
(e.g. `color.brand.primary`). Keying identity by path alone means a rename reads as
delete-old + add-new, losing history and producing spurious conflicts. A stable identity
independent of path fixes this, but it must survive the file round-trip.

## Decision

- **Each token carries a stable ID under `$extensions`.** Vertekum uses a reverse-DNS
  extension key (`com.vertekum`) holding an `id` — e.g.
  `"$extensions": { "com.vertekum": { "id": "…" } }`. Files are therefore deliberately not
  pure DTCG.
- **Deterministic minting on import.** When importing a file whose tokens lack a Vertekum
  ID, mint IDs **deterministically, seeded from each token's path**, so re-importing the
  same foreign file yields the same IDs and 3-way merge stays stable across re-imports.
  Any existing Vertekum IDs are preserved as-is.

## Consequences

- Exported files carry Vertekum metadata under `$extensions`. This is an accepted trade-off
  against pure-DTCG portability; consumers that ignore unknown `$extensions` are unaffected.
- Renames and moves are tracked by ID across merges rather than read as delete + add.
- Path-seeded minting is stable only while paths are stable; a token created in Vertekum
  gets a durable ID at creation time that then survives subsequent renames.
