# 29. Extension surfaces: api / ui / cli

Date: 2026-08-04

## Status

Accepted

## Context

Vertekum's capability (tokens → resolve → output) should be drivable headlessly, by agents and CI,
with the GUI as one more driver rather than the only one. The exporter registry (ADR-0018, `df39dca`)
put the transform contract in core, but the only way to reach it was the React export route.

The blocker was module evaluation, not architecture. A consumer config lists extensions; importing
one evaluated its whole graph, including React components and their `.css` imports — meaningless in
Node, and fatal to any plain-Node loader. `vertekum dev` worked around this with a Vite SSR CSS stub,
which is acceptable for a command that runs Vite anyway and wrong for a build command that should not.

## Decision

Each extension package splits into three surfaces, with matching package subpath exports:

- **`index.ts`** — identity only: manifest, settings schema, `defineExtension`. No React.
- **`api.ts`** — the extension's **registry of methods**: its functions, plus the activation that
  publishes them to the service registry. Imports `vertekum/core`, never `vertekum`.
- **`ui.tsx`** — components and CSS. Default-exports a `LazyView`. Imports `vertekum`.
- **`cli.ts`** — commands. A declared convention; populated when extension-contributed commands
  arrive (ADR-0030).

`api.ts` exports functions **and** registers them as services. Direct import serves consumers that
know the package statically (its own `ui`/`cli`, its tests); the **service registry** serves dynamic
discovery across extension boundaries — what `vertekum describe` enumerates, and what lets an agent
ask which exporters exist without knowing package names.

**Laziness lives at the `mount` seam**, which already permitted it: `MountFn` is
`(element, context) => cleanup`, and nothing requires the view to exist when mount is called. An
`api` surface registers route path and ribbon as data plus `mount: lazyMount(() => import('./ui'), ctx)`.
`lazyMount` lives at its own `vertekum/lazy-mount` subpath and imports `reactMount` lazily, so its own
module graph is React-free.

Consequently **`defineExtension`, `MountFn`, and `kernel.start()` are unchanged**, and there is no
profile concept: a headless boot loads `index → api`, never calls `mount`, and never evaluates a `ui`
module.

`@vertekum/ext-value-editors` needed one contract change, because it publishes React components *as*
services. `ValueEditorRegistration` now holds `load: () => Promise<{ default: ValueEditor }>` instead
of `component`, `resolve(type)` returns that loader, and `ValueField` wraps it with `React.lazy`.

**Enforcement is a test, not a constraint.** Nothing structurally prevents an `api.ts` from importing
its `ui`. A spec spawns plain `node --import tsx/esm` over every `api` surface and over the example
config; tsx transpiles TypeScript but has no CSS loader, so any reach into a `ui` module fails with
`ERR_UNKNOWN_FILE_EXTENSION`. This cannot be a vitest assertion — vitest runs through Vite, which
loads CSS happily and would never catch the leak.

## Consequences

- `vertekum build`, `check`, and `describe` load no React and no Vite. The CSS stub survives only in
  `vertekum dev`.
- Extension authors have a stated rule for where code goes, and the import specifier (`vertekum/core`
  vs `vertekum`) makes the boundary visible in the import list.
- The `cli` surface has a home before it has contents, so extension-contributed commands add files
  rather than architecture.
- The boundary is convention plus a test. A leak is caught at test time, not compile time.

## Alternatives rejected

- **Descriptor with lazy surface loaders** (`ui: () => import('./ui')` inside `defineExtension`).
  Works, and lets the kernel enumerate surfaces without loading them. Rejected for cost: a new
  extension shape, async `start()`, and a profile concept — to enforce a boundary one test enforces.
- **Convention-based resolution** (manifest declares its package; kernel does `import(pkg + '/ui')`).
  The most sugar-free option, and fatal in the browser: Vite and Rollup cannot statically analyze a
  computed specifier, so the SPA loses code-splitting and the build errors. Literal thunks are
  required.

## Amendment (2026-08-16): publishable extensions import `@vertekum/core` directly

The `vertekum/core` subpath exists so app-side extension authors write one import specifier and the
boundary stays visible. A **publishable** extension cannot ride it: `vertekum` (the app) is a private
package, and a peer dependency on it would make the extension uninstallable outside this repository.
Publishable non-view extensions (`ext-export-terrazzo`, `ext-export-css`) therefore import
`@vertekum/core` directly and declare it as their peer. App-side extensions keep `vertekum/core`.
The two specifiers resolve to the same module; the rule is about the dependency edge, not the code.
