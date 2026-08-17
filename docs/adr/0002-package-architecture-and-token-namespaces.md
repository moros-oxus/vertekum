# 2. Package architecture and token namespaces

Date: 2026-07-02

## Status

Accepted

## Context

The app package (`@vertekum/app`) and the UI kit (`@vertekum-ui/react`) needed a settled relation: what the UI kit is
relative to the app, and — critically — how the tokens that style the app's own interface
relate to the tokens the user is editing. If those were the same set, editing a color would
restyle the whole application mid-edit.

## Decision

- **Dependency direction is one-way: `@vertekum/app` depends on `@vertekum-ui/react` (app → ui).**
  The UI kit is the app's internal design system (buttons, inputs, layout); it
  knows nothing about the app and must not import from it.
- **Two disjoint token namespaces.** The **app tokens** that the UI kit uses to style the
  app chrome are fully isolated from the **document tokens** the user edits and curates.
  Document tokens never style the app chrome.
- **No live token preview feature.** Previewing edited tokens is not part of the app, so
  document tokens are never injected into the running DOM as app styling.

## Consequences

- The UI kit is independently reasoned about and cannot take a dependency on app state.
- Editing document tokens can never mutate the app's own appearance — the two namespaces
  never share a cascade.
- Because there is no preview surface, we avoid the CSS-isolation problem entirely (CSS
  custom properties would otherwise leak across Shadow DOM into app chrome). If a preview
  is ever added, it must be reconsidered as a new decision (likely an `iframe` for a
  separate cascade).
