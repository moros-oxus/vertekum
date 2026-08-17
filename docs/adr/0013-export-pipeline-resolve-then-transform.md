# 13. Export pipeline: two-stage resolve then transform

Date: 2026-07-02

## Status

Accepted — the resolve stage is fulfilled by the resolver module (ADR-0031)

## Context

Consumers need different formats and subsets of the DTCG data (e.g. Figma/Penpot cannot read
`$extensions`), and they have opinionated theme handling (native modes vs. selectors vs.
per-theme files). We had to decide whether resolving themes and producing target output is
one stage or two.

## Decision

Export is a **two-stage pipeline** with a clean seam:

1. **Resolve** (resolver-module composition, ADR-0031): authored sets + resolver document →
   a **composed, context-aware bundle** per selection. Parameterizable: which contexts, and
   references resolved-to-values vs. kept. Format-agnostic and shared.
2. **Transform** (`Exporter`): consumes the composed bundle, decides how to express contexts
   for its target, subsets/renames/serializes to the artifact (Figma variables, Penpot, CSS
   custom properties, Tailwind, iOS, Android).

One resolver feeds many exporters. Consumers split by **directionality**: design targets are
round-trippable (ADR-0014), platform/build targets are terminal.

## Consequences

- Theme logic lives in one place; exporters never re-implement resolution.
- Keeping the composed model context-aware lets native-mode targets translate contexts
  instead of flattening; per-theme-file targets loop the contexts.
- Target-specific **naming** is a transform concern that re-maps the authored naming from the
  SchemaProvider.
- Resolvers and exporters are pure data-in/data-out — the archetypal sandboxed tier
  (ADR-0010).
