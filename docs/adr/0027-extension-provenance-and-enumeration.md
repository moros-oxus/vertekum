# 27. Extension provenance and enumeration

Date: 2026-07-05

## Status

Accepted — implements the Extensions & Settings surface (design spec
`2026-07-05-extensions-and-settings-surface`, process archive outside the repo,
building on ADR-0022)

## Context

ADR-0022 deferred a VS Code-like "Extensions & Settings" area listing installed
HostExtensions, their capabilities, and settings — including non-view extensions
that contribute no ribbon entry. Two gaps blocked it: the kernel kept registered
extensions in a private array (nothing could enumerate them), and contribution
points (routes/services/slots) are imperative in `activate()` (ADR-0024), so no
data records what an extension actually contributes.

## Decision

- **Record contributions truthfully via attributed registries, don't declare them.**
  In `kernel.start()`, each extension's `activate()` receives per-extension wrapper
  registries for routes/services/slots that tag every registration with the
  extension's id before delegating — the same seam already used for
  `scopedConfig(config, id)`. A `contributions` map accumulates `{ routes, services,
  slots }` per id.
- **This keeps ADR-0024's thin manifest intact.** Capabilities are observed, not
  moved into the manifest; the only manifest addition is an optional human
  `description` — the one display fact provenance cannot derive.
- **`kernel.getExtensions()` exposes `{ manifest, contributions, active }[]`.** The
  surface is a view over this snapshot; there is no install/uninstall at runtime.
- **The surface folds in settings.** The privileged `/extensions` route (registered
  by the shell, like the former `/settings`) is master/detail; per-extension
  settings reuse the existing Zod-driven renderer. The combined `/settings` page is
  removed.

## Consequences

- `ExtensionContributions`, `InstalledExtension`, and `Kernel.getExtensions()` live
  in `@vertekum/core`; the manifest gains `description?`.
- Capability data cannot drift from reality (it is whatever ran), unlike a declared
  manifest would.
- A first-party non-view demonstrator (`vtk.stats`) publishes `TokenStatsService`,
  consumed by the Dashboard (soft-dependency, ADR-0023), proving the surface shows
  extensions with no ribbon entry. Its contract and pure counting live with the
  extension (`@vertekum/ext-stats`), not the kernel — token-stats is a feature, not a core
  concept (ADR-0009); core stays thin.
- Enumerate-without-executing (hosted/sandboxed loading) remains the deferred seam
  from ADR-0024; provenance is a runtime record, not a static one.
