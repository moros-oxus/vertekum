# 14. Design-tool bridge and companion seam

Date: 2026-07-02

## Status

Accepted

## Context

Vertekum is the source of truth, but it may not be where editing starts or primarily
happens, so edits made in a design tool (Figma/Penpot) must be able to flow back — even
though those tools strip `$extensions` (and thus the Vertekum `id`s) on the round-trip. The
round-trip therefore has to be considered from day one.

## Decision

A design-tool integration is a **cross-runtime bridge**, not a single plugin:

- A **Vertekum-side Importer/Exporter plugin** (sandboxed tier). Export = the transform stage
  (ADR-0013, out). Import = parse the tool's format → reconcile ids → feed the incoming set
  into the **3-way merge against the working copy** (ADR-0004). No new sync engine.
- An **optional host-side companion** (e.g. a Figma plugin) that runs *inside* the design
  tool and preserves the stripped metadata (`id`s, `$extensions`) in the tool's own plugin
  storage, via a defined **sidecar-metadata contract**.

**Fidelity tiers:** with a companion → real ids/`$extensions` return → near-lossless merge;
without one → fall back to **deterministic path-seeded id minting (ADR-0005)**, best-effort.
Round-trip vs. treat-as-downstream-only is a **user/workflow setting**.

Day-one scope: the bidirectional Importer/Exporter and the sidecar contract (the **seam**).
Actual companion tools are built incrementally against it.

## Consequences

- Bidirectional round-trip reuses the existing merge (ADR-0004) and id machinery (ADR-0005);
  ADR-0005's minting is the *fallback tier*, not the whole answer.
- Design tools are **downstream-but-round-trippable**; platform outputs remain terminal.
- Committing to the sidecar contract early avoids format/version churn when companions ship.
