# 13. Export pipeline: two-stage resolve then transform

Date: 2026-07-02

## Status

Accepted — the resolve stage is fulfilled by the resolver module (ADR-0031); amended 2026-09-24 (resolve + prepare)

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

## Amendment (2026-09-24): the resolve stage is resolve + prepare

Two exporters had come to see two different inputs: a tool reading staged files got generated
tokens expanded and custom types presented through the `build` chain, while an exporter reading
resolved bundles got the raw store — so a custom type reached one target and not another, and a
generated token (a colour ramp) resolved its anchor across the whole flattened collection, where
one brand's definition silently won for every brand.

Stage 1 now ends in **prepare**, identical for every exporter:

- **Generated tokens expand in their own scope** — the carrier's file, then the files its
  compositions resolve it with, then the collection.
- **Custom types lower to standard DTCG types.** The extension owning a type registers a
  lowering (`TYPE_LOWERING_SERVICE`) once; resolved bundles and staged files are both lowered, so
  a transform never needs to know a project's own types.
- **Presentations stay, per exporter.** A `build` chain link sees which exporter it stages for and
  may present for that one alone (a CSS shorthand); precedence is presentation → lowering → as
  authored. Offering one is the extension author's choice; the lowering is the guarantee.

Consequence: "exporters never re-implement resolution" extends to types and generation — a
transform consumes standard types, fully expanded, whatever the project's extensions.
