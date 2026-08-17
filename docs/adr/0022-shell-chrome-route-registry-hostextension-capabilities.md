# 22. Shell chrome, route registry, and HostExtension capabilities

Date: 2026-07-03

## Status

Accepted — refines ADR-0016

## Context

ADR-0016 gave the kernel base slots (sidebar/main/panel/toolbar/statusBar) and modeled
routes as full-window slots. Building the core loop clarified a cleaner model: a
persistent chrome plus routes that own their own layout, with token editing as the main
route HostExtension. The DX of building a route should feel like building a webpage.

## Decision

- **Base slots = persistent chrome:** **`ribbon`** (a command/nav rail of icon-links),
  **`toolbar`**, **`main`** (the single active-route outlet), and **`statusBar`**. The old
  `sidebar` and `panel` are removed — they belong to whichever route owns them.
- **Kernel route registry.** A **HostExtension** may optionally contribute a **route
  subtree** (mounts into `main`), a **ribbon entry** (a nav link to its route root;
  optional — deep/child routes need none), and its **own namespaced sub-slots** via the
  recursive slot registry (ADR-0016).
- **Route-ness is one optional capability** of a HostExtension, alongside commands,
  settings, and views. **Non-view** extensions contribute no route or ribbon entry and are
  surfaced later through an **"Extensions & Settings"** area (VS Code-like). The ribbon only
  shows extensions that opted into a nav entry.
- **TanStack Router** drives the registry inside the app shell and is an implementation
  detail; **route plugins never import it** (framework-agnostic, ADR-0017).

## Consequences

- Building a route feels like building a webpage: routes own their layout and sub-slots;
  the kernel provides chrome plus a mount point.
- Refines ADR-0016: the chrome persists and routes fill `main`, rather than routes being
  literal full-window slots.
- The skeleton ships two route HostExtensions — **Dashboard** (`/`, blank) and **Tokens**
  (`/tokens`, the main one, owning its sidebar + editor sub-slots) — replacing the earlier
  fixed sidebar/panel plan.
- Introduces groundwork for a future **Extensions & Settings** surface (see Deferred).
