# 24. Extension manifest and entry contract

Date: 2026-07-03

## Status

Accepted — implements the entry-contract decisions of the design spec
`2026-07-03-extension-framework-and-config` (process archive, outside the repo)

## Context

The walking skeleton's extension shape was `{ id, activate(ctx) }`, registered via a
hardcoded list in `main.tsx`. Hardening it required deciding what an extension *is*
before deciding how it's loaded: whether contribution points (routes, slots, services)
belong in a static manifest, or stay imperative code in `activate()`.

## Decision

- **Two named exports per extension module:** `export const manifest satisfies
  ExtensionManifest` (typed, side-effect-free data) and `export function activate(ctx:
  ActivateContext<typeof manifest>)` (runtime behavior) — the VS Code model, not a
  single ambiguous Storybook-style module.
- **`satisfies`, not a wrapper function.** A `defineExtension({...})` call would bury
  the manifest inside a call expression and defeat static extraction. `satisfies
  ExtensionManifest` type-checks the same literal while keeping it a bare, statically
  visible `const` — the property a future build-time reader needs.
- **The manifest is thin: identity (`id`, `name`) + an optional Zod `settings` schema
  + a shape-only `activation` field.** Routes, slots, and services stay imperative in
  `activate()`, exactly as before. Two reasons: (1) a ribbon icon is a React
  component — behavior, not data — so forcing routes into a serializable manifest
  would either degrade icons to named strings or smuggle a component into an object
  that claims to be serializable but can't round-trip; (2) a "rich" static manifest's
  only wins (enumerate-without-executing, lazy activation) are hosted/sandboxed
  concerns we've deferred — everything is bundled and executed today, so declaring
  routes statically buys nothing yet.
- **Zod as the schema substrate** for `manifest.settings`. One schema drives defaults,
  runtime validation (`ExtensionManifestSchema` guards the manifest shape itself), and
  the type on `ctx.config`/`useConfig` via `z.infer`.
- The manifest earns its existence for exactly one thing the host needs *before*
  `activate()` runs: the settings schema, so the config store can be built and a
  populated `ctx.config` handed into activation (see ADR-0025).

## Consequences

- `ExtensionManifest`, `ExtensionManifestSchema`, and `ActivateContext<M>` live in
  `@vertekum/core` (`packages/workbench/core/src/config/manifest.ts`), which gains a `zod`
  dependency.
- Authoring an extension is unchanged for routes/slots/services; only identity and
  settings moved to a static export.
- The build-time Vite plugin that would extract `manifest` into a `vertekum.json`
  sidecar (for enumerate-without-executing / hosted loading) is a noted **seam**, not
  built. The manifest is written to convert trivially to that JSON form — no imports of
  runtime values — but nothing consumes it that way yet.
