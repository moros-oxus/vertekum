# 31. DTCG Resolver Module as theme composition

Date: 2026-08-14

## Status

Accepted — supersedes the retired theme-model line (plugin-owned ThemeProvider with a
kernel resolve contract; the multi-axis mode model; per-token `vtk.themes` overrides).
Of that line, only "value editors are a typed extension point" survives — in ADR-0028.

## Context

Three generations of theme model preceded this: a plugin-owned ThemeProvider
with a kernel `resolve()` contract, a multi-axis mode model, and flat
per-token overrides stored under
`$extensions.org.vertekum.themes`. Building the last one exposed
the structural problem: theming lived *inside each token*, so composition
logic (which values win, for which audience) was smeared across the
collection and invisible to other tooling. Meanwhile the DTCG published the
**Resolver Module**, a spec-defined document format for exactly this.

## Decision

**Resolver documents are the single theme-composition truth.** A resolver
file declares **sets** (references to token files) and **modifiers** whose
**contexts** select alternative sets — light/dark, brand, density. Vertekum
adds no theme representation of its own:

- A **composition** is a named resolver file; config and CLI refer to
  compositions by that name.
- **Resolution is two-level.** Structure-level: the resolution order is
  flattened into a single tokens structure per context selection.
  Value-level: references (curly aliases and JSON Pointer `$ref`s) resolve
  against that **composed document**, per the resolver spec's rule that
  aliases must not be resolved before flattening.
- **Consumers see composed bundles, never theme shapes.** Exporters receive
  the composed, per-context result; validators run per composition (a
  diagnostic names the context it occurred under); the UI's composed view is
  the same merge.
- **Per-token theme overrides are retired.** `$extensions.org.vertekum.themes`
  is removed from the model, the editors, and the exporters; a theme variant
  is expressed as a set selected by a modifier context.

## Consequences

- Theme composition is portable by specification: any Resolver-Module-aware
  tool reads the same truth, which is what makes file hand-off exporters
  (e.g. the terrazzo bridge) possible without translation.
- Diagnostics multiply per composition by design — a reference that dangles
  only under `theme=dark` is reported under that label.
- The composed document is the reference scope everywhere, so alias and
  pointer semantics are identical in the editor, the validators, and every
  export.
- Token files stay pure DTCG: nothing Vertekum-specific is required to
  express theming.
