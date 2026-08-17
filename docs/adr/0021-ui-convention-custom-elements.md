# 21. UI conventions: HTML-first, custom elements, attributes

Date: 2026-07-03

## Status

Accepted

## Context

We want consistent, styleable, accessibility-friendly markup across the shell and
extensions, and a rule that applies equally to human and agent contributors. The guiding
philosophy: a React component returns HTML — it *extends* HTML — so it should lean on native
HTML semantics and attribute conventions rather than reinventing them.

## Decision

- **HTML-first.** Use native HTML elements when they already carry the needed semantics —
  landmarks (`<main>`, `<nav>`, `<header>`), controls (`<button>`, `<a>`, `<label>`), lists.
  Reach for a **custom `vtk-` element** only when no native element fits — typically pure
  layout containers (e.g. `<vtk-slot-host>`). It is still a web *document*: structure, order,
  and semantics matter.
- **CTE accessibility.** When a CTE is used, handle role + interaction: presentational
  (div-like) → nothing; stands in for a landmark/role with no interaction → set the role
  explicitly (but prefer the native element); interactive/nuanced → back it with an
  `ElementInternals` wrapper class (deferred for the skeleton).
- **Labelling precedence** (accessibility): (1) native HTML (`<label>`, inner text); (2)
  visually-hidden `.sr-only` text when the native route also applies (icon-buttons); (3)
  `aria-labelledby` with visible text; (4) `aria-label` as a last resort / code-smell
  (exceptions: iframes, landmarks with no visible label source).
- **Variants via attributes, not classes.** Prefer a namespaced data attribute
  **`data-vtk-variant="…"`** (namespaced to avoid collisions) over a class. Classes are a
  last resort when neither the tag nor an attribute expresses the intent.
- **Components extend HTML.** A React component uses the underlying element's **native
  attributes** where possible. When a custom prop is required it follows **HTML attribute
  naming conventions**, and styleable props are passed down to the element as **`data-*`
  attributes**.
- **Interactive state uses CSS-native signals first.** Prefer CSS pseudo-classes and native
  attributes (`:hover`, `:checked`, `[disabled]`, `[aria-*]`…). Use `data-*` attributes only
  for state that isn't expressible that way or must be set explicitly.
- **Identity on demand.** Prefer **no identity attribute**: reach elements via refs/composition
  internally and classify/style them via `data-vtk-*`. Add an **`id`** (prefixed `vtk-…`) only
  when a *unique DOM handle* is genuinely needed — an ARIA relationship (`aria-controls`,
  `aria-labelledby`), `getElementById`, a URL-fragment anchor, or a stable test target — never
  speculatively. Use **`name`** only to submit form data. Don't carry the same value in both an
  `id` and a `data-*` attribute unless each has a distinct, live purpose.
- **Custom tags are unregistered** (no shadow DOM / `customElements.define`) unless behavior
  is genuinely needed; in React 19 + TS they require a JSX intrinsic-elements declaration.

## Consequences

- Predictable, style-targetable, accessibility-friendly structure; groundwork for CSS
  `@scope` (TBD).
- Namespaced data attributes (`data-vtk-*`) are the default carrier for variants/explicit
  state; the exact scheme is still being firmed up.
- The actionable rules live in `docs/conventions/ui.md`, pointed to from `AGENTS.md`.
- Applied starting with `SlotHost` (`<vtk-slot-host data-vtk-slot="…">`, no speculative id)
  and the shell regions.
