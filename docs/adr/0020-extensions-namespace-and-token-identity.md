# 20. `$extensions` namespace and token identity

Date: 2026-07-03

## Status

Accepted — refines ADR-0005; amended: the normalized token preserves **all**
`org.vertekum.*` sub-keys in a generic `vtk` bucket that round-trips (`ident` is lifted to
`id`), not just `ident`+`meta`

## Context

ADR-0005 stored Vertekum data under a single `$extensions` key (`com.vertekum`) holding
`{ id }`. Two issues: identity and any future metadata were conflated under one key; and the
id-minting delimiter was a fragile, undocumented literal NUL byte in source.

## Decision

- **Reverse-DNS root.** Vertekum namespaces its `$extensions` keys under **`org.vertekum`**.
- **Sub-key names its premise.** Concerns are split into sub-keys, where the sub-key
  represents the premise of the data it holds:
  - **`org.vertekum.ident`** — the token's stable identity (the merge key).
  - **`org.vertekum.meta`** — other per-token metadata (a reserved bucket; currently empty).
  Future concerns get their own premise-named sub-keys.
- **Configurable root (future).** The `org.vertekum` root will become configurable via a
  project config file — the first of likely several config concerns. See Deferred.
- **Id minting delimiter.** Path segments are joined with `.`, which DTCG reserves (names
  cannot contain it), so distinct paths never collide — replacing the fragile NUL byte.

## Consequences

- Identity is encapsulated from evolving metadata: consumers/plugins can read or strip a
  metadata sub-key without ever touching `org.vertekum.ident`.
- The normalized token carries `id` and optional `meta`; parse lifts the `org.vertekum.*`
  sub-keys and serialize re-injects them, while foreign vendor extensions round-trip untouched.
- `meta` is a **provisional** name — as concrete concerns land they will get premise-named
  sub-keys, and `meta` may shrink or be retired.
- Introduces the first need for a **project config file** (see CONTEXT.md "Deferred
  branches"); more config will follow.
