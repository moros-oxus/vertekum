# 28. Value editor registry: React components via the service registry

Date: 2026-07-06

## Status

Accepted — absorbs the retired theme-model line's surviving decision, "value editors are a
typed extension point," which had shipped only as a hardcoded `type === 'color'` ternary. Editing UX (a disclosed edit panel) and
undo coalescing are separate, later increments.

## Context

Value editors were private to the Tokens view, so they were not pluggable, did not survive a
Tokens-view swap, and referenced values (`{group.token}`) broke their type editor. An editor
can be at most two of {framework-agnostic, dumb (value-in/onCommit-out), live-updating}.

## Decision

- **React components, not `mount()`.** Editors are `({ value, onCommit }) => JSX` — dumb and
  live-updating (value is a prop), dropping framework-agnosticism *at the cell level*. The
  `mount()` boundary (ADR-0017) stays at the route/slot level, where a swapped-in view still
  crosses it.
- **Registry rides the service registry.** A non-view extension `vtk.value-editors` publishes
  one `VALUE_EDITOR_SERVICE`; the kernel stays React-free (no `ComponentType` in `@vertekum/core`).
  Editors are contributable by any extension via `activate(ctx)`.
- **id + config selection, first-registered default.** Editors carry a stable id; `resolve(type)`
  applies the user's `preferred[type]` config then the first-registered editor for the type.
  Availability is build-time composition (ADR-0011); selection is a runtime user setting
  surfaced in the Extensions & Settings area (ADR-0027) and persisted per collection (ADR-0025).
- **References are orthogonal.** The consumer routes `isReference(value)` to a text editor
  before type resolution; type editors stay literal-only. A real reference editor is deferred.

## Consequences

- Editors are decoupled from any view and from theme semantics (the absorbed decision, kept).
- Individual plugin editors are not yet attributed in the Extensions surface (they register
  into the shared service, not via `ctx.services.register`) — a deferred surface refinement.
- `boolean` is registered though it is not a canonical DTCG `$type`; it is dormant unless a
  token declares `$type: "boolean"`.
