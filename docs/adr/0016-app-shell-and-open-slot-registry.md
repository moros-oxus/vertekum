# 16. App shell and unified open slot registry

Date: 2026-07-02

## Status

Accepted

## Context

Features ship as HostExtensions (ADR-0009), so they must contribute UI into a shell without
fighting over the DOM. We evaluated a VS Code-style slot/contribution model, a free-form
mount, and a route/page model — and whether extensions may define their *own* contribution
points.

## Decision

A **thin kernel shell** owns layout via a base set of **slots** (sidebar, main, panel,
toolbar, status bar) plus command / menu / view registries. HostExtensions contribute
**declaratively** (manifest) and **imperatively** (a UI API).

The slot registry is **unified, open, and recursive**:

- A **slot** is a named region contributions render into.
- A **route/page** is just a **full-window slot** the shell's router mounts — so the
  route model collapses into the slot model.
- **Trusted HostExtensions** may **define new (namespaced) slots and routes** that other
  plugins fill — the UI twin of "HostExtensions publish bus hooks" (ADR-0010). Sandboxed and
  cheap-tier plugins may only *fill* existing slots, never define them.

## Consequences

- The slot/registry vocabulary is the first concrete kernel UI-API surface; it is dogfooded
  by first-party features (ADR-0009).
- Extension-defined slots are namespaced by extension id to avoid collisions/ordering fights.
- The walking skeleton uses only the kernel base slots; the open/recursive capability is
  designed in from the start so it is not retrofitted.
