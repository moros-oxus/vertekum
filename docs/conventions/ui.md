# UI conventions

Coding rules for UI markup in Vertekum, for human and agent contributors alike. Decision
recorded in ADR-0021.

**Philosophy:** a React component returns HTML — it *extends* HTML. Lean on native semantics
and HTML attribute conventions rather than reinventing them.

## HTML-first; custom elements only when needed

It's still a **web document**: DOM structure, order, and semantics matter regardless of this
being a "web app".

- Use **native HTML elements** when they carry the semantics you need — landmarks
  (`<main>`, `<nav>`, `<header>`, `<aside>`), interactive controls (`<button>`, `<a>`,
  `<label>`), lists, etc. They give behavior and accessibility for free.
- Use a **custom `vtk-` element (CTE)** only when no native element fits — typically pure
  **layout/presentational** containers (`<vtk-shell>`, `<vtk-ribbon>`, `<vtk-slot-host>`).
  Layout rarely needs semantics. Prefix `vtk-` + a semantic name; **ask when unsure**.
- Custom tags are **unregistered** (no shadow DOM, no `customElements.define`) unless behavior
  is genuinely required. In React 19 + TS declare them in a JSX intrinsic-elements
  augmentation (see `packages/workbench/app/src/vtk-elements.d.ts`).

## CTEs for common interactive patterns

CTEs are not only for pure layout. Reach for a `vtk-` CTE for a **common interactive pattern**
when native HTML can't carry the semantics without breaking another rule — e.g. a **disclosure
that must host extra interactive controls** in its header (`<details>/<summary>` can't:
`<summary>` is itself the toggle, so nesting interactives is invalid). The disclosure primitive
`vtk-concertina-*` is the reference case.

- **Interactivity stays native** inside the CTE — the toggle and any controls are real
  `<button>`s. It's a plain CTE (no `customElements.define`) and can gain `ElementInternals` later.
- **Roles on demand** — the tag name conveys intent; add `role`/ARIA only when it must reach AT.
- **State via native/ARIA first** — disclosure state is the trigger's `aria-expanded`; the item
  mirrors it as `data-vtk-open` for styling only.
- **Base patterns are compositional** — accordion/concertina/combobox-class primitives are compound
  families in `@vertekum-ui/react` (`<Concertina><ConcertinaItem>…`); data-driven assembly belongs to the
  layer that owns the data. React components + their `Props` drop the `Vtk` prefix; the prefix stays
  on `VtkBaseElement`, `VtkComponentProps`, and element defs (`VtkConcertinaElement`).

(While aceify is on hold, `@vertekum-ui/react`'s `vtk-elements.d.ts` is hand-maintained rather than
generated.)

## Custom elements & accessibility

When a CTE is used, accessibility is paramount — consider **role** and **interaction**:

- **Purely presentational** (div-like layout): nothing to do.
- **Implicit role, no interaction** (the CTE stands in for a landmark/semantic element): apply
  the role **explicitly** (e.g. a nav-like CTE → `role="navigation"`). In practice, prefer the
  native element instead — e.g. wrap links in a real `<nav>`.
- **Interactive or nuanced** (extends a control, or has complex semantics): back it with a thin
  wrapper class using **`ElementInternals`** to expose role/state/AOM. *(Deferred for the
  skeleton — keep it simple now; this becomes a rule when we author such CTEs.)*

## Labelling (accessibility)

Preferred labelling techniques, in order of precedence:

1. **Native HTML** — `<label>` for form controls; inner text for buttons/anchors
   (`<button>Label</button>`).
2. **Visually-hidden text** (`.sr-only`) — only when the native route also applies, e.g. an
   icon-button: `<button><svg aria-hidden /><span class="sr-only">Label</span></button>`.
   (Some exceptions.)
3. **`aria-labelledby`** referencing **visible** text.
4. **`aria-label`** — last resort, treated as code-smell. Exceptions: `<iframe>`s, landmark
   regions with no visible label source, or when genuinely no other option exists.

## Variants and state via attributes

- **Variants:** prefer a namespaced data attribute **`data-vtk-variant="name"`** over a
  class. (The `data-vtk-*` scheme avoids collisions; exact scheme is still TBD.)
- **State:** prefer CSS-native signals first — pseudo-classes and native/ARIA attributes
  (`:hover`, `:checked`, `[disabled]`, `[aria-expanded]`…). Use a `data-*` attribute only for
  state that isn't expressible that way or that must be set explicitly.
- **Classes** are a last resort, when neither the tag nor an attribute expresses the intent.

## Components extend HTML

- Use the underlying element's **native attributes** when possible.
- When a custom prop is required, name it following **HTML attribute conventions**.
- **Styleable props** are passed down to the element as **`data-*`** attributes.

## Identity: attributes on demand

- **Default to no identity attribute.** Reach elements via refs/composition internally;
  classify and style via `data-vtk-*` (which also carries the semantic value).
- Add an **`id`** only when a *unique DOM handle* is genuinely needed — an ARIA relationship
  (`aria-controls`, `aria-labelledby`), `getElementById`, a URL-fragment anchor, or a stable
  test target. Prefix it `vtk-…` (add a group/domain segment for specificity, e.g.
  `vtk-slot-<id>`). Do not add it speculatively.
- Use **`name`** only to submit form data.
- Don't carry the same value in both an `id` and a `data-*` attribute unless each has a
  distinct, live purpose.
- Example: `<SlotHost id="toolbar" />` renders `<vtk-slot-host data-vtk-slot="toolbar">` — no
  DOM `id`, because nothing references that node uniquely (yet).

## Prefix registry

- `vtk-` — shell and app structural elements / ids (this repo).
- `vtk-concertina-*` — the `@vertekum-ui/react` disclosure primitive (compound family).
- Extensions may use their own `vtk-<ext>-` sub-prefix for their elements and ids.
