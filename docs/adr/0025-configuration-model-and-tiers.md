# 25. Configuration model and tiers

Date: 2026-07-03

## Status

Accepted — implements the configuration decisions of the design spec
`2026-07-03-extension-framework-and-config` (process archive, outside the repo)

## Context

Extensions and the app need layered configuration: a schema's own defaults, a
project's overrides, and a user's live edits, merged into one value per extension —
without extensions reading each other's storage or the merge order becoming
ambiguous.

## Decision

- **Three-tier merge per extension id, lowest → highest precedence:** schema
  defaults ⊕ host-config overrides (tier 2, `vertekum.config.ts`) ⊕ user-runtime
  overrides (tier 3, the settings panel). **User-runtime wins.** Deliberate: Vertekum
  is a single-user local tool, so a designer's live edit should stick over a project
  default; tier 2 is a starting default, not a lock.
- **The pure merge engine (`ConfigStore`, `packages/workbench/core/src/config/
  config-store.ts`) lives in `@vertekum/core` and does no I/O.** It namespaces by
  extension `id`, applies the Zod schema to produce defaults + validation, and caches
  a stable snapshot per id that's invalidated (and listeners notified) only when a
  tier changes for that id.
- **Config is a view concern, read via `useConfig`, not read in `activate()`.**
  Settings like `density`/`showIds` shape how views render, so they're consumed in
  React via `useConfig<typeof manifest>()` (a `useSyncExternalStore` wrapper over
  `ScopedConfig`), mirroring the existing `useTokens` pattern. `activate()` receives
  `ctx.config` as a live accessor but only reads it when a setting shapes registration
  itself — rare, since `activate()` runs once and won't re-wire on live changes.
- **Defaults live in the schema, not supplied at activation.** `z.…().default(…)` on
  `manifest.settings` is the single source of default values; nothing else defines
  defaults.
- **Stable-reference store rule.** `ConfigStore.get(id)` must return the same
  reference until that extension's slice actually changes, so `useSyncExternalStore`
  subscribers don't tear or over-render — the same discipline `useTokens` already
  follows.
- **Per-collection persistence.** Tier-3 user overrides are persisted to
  `.vertekum/settings.json` via the local bridge (`SettingsClient.load`/`save` in
  `packages/workbench/app/src/config/settings-client.ts`, ADR-0015), loaded at
  startup and hydrated into the store, written back on every panel edit.

## Consequences

- `ExtensionSettings<M>`/`ActivateContext<M>` infer their type from one Zod schema, so
  `ctx.config` and `useConfig` never drift from what the panel edits.
- Config storage is per-collection (travels with the token repo), not per-machine —
  a direct consequence of tier 2 being a project file (ADR-0026).
- Org/hosted defaults that could *pin* a value above user-runtime are an explicit
  non-goal for now; only the local host-config tier exists.
