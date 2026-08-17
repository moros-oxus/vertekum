# 17. UI boundary and framework

Date: 2026-07-02

## Status

Accepted

## Context

The slot registry (ADR-0016) needs a rendering contract. If a slot mounts the host
framework's components directly, every UI plugin — including future third-party ones —
would be locked to that framework forever, against the "built to be extended" constraint.

## Decision

- **The slot boundary is framework-agnostic**: a slot mounts a DOM node / custom element via
  a **`mount(element, context)`** contract. The framework becomes an internal detail.
- **First-party HostExtensions (and `vtk-ui`) use React** internally, exposing the mount
  contract. Third-party arbitrary UI (Scenario 4) comes in through the same boundary as
  custom elements, in any framework.
- **Routing uses TanStack Router**, backing the route = full-window-slot mechanism (ADR-0016).

## Consequences

- The plugin ecosystem is never locked to React; the framework choice is reversible-ish.
- First-party development gets React's ecosystem and component tooling for `vtk-ui`.
- The mount contract works with any framework (`createRoot(el).render(...)` etc.), so the
  boundary imposes no framework on contributors.
