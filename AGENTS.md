# Vertekum — working in this repo

Vertekum is a headless, config-driven design-token capability (DTCG tokens in → composed,
validated output out), with a browser app as a thin layer over the same core. Before
touching code: read **`CONTEXT.md`** — the domain glossary is authoritative vocabulary —
and skim the ADRs in **`docs/adr/`** (0001–0031) that touch your area. If your change
contradicts an ADR, surface it; don't silently override it.

## Repo map

- `packages/workbench/core` — the kernel: DTCG parsing/serialization, resolver
  composition, validation, exporter registry, config engine. Everything headless lives here.
- `packages/workbench/cli` — `vertekum` verbs (`build`, `check`, `describe`, contributed
  commands) plus the CLI e2e specs.
- `packages/workbench/server` — the local bridge (filesystem + git for the browser app).
- `packages/workbench/app` — the browser SPA (thin layer; currently deferred).
- `packages/extensions/*` — first-party HostExtensions (`ext-export-css`,
  `ext-export-terrazzo`, `ext-release`, UI extensions…).
- `packages/schemas/*` — published schema packages (`schema-dtcg`, `schema-atlassian`).
- `packages/ui-system/*` — `@vertekum-ui/react` (the app's UI kit) and `primitives`
  (Vertekum's own token collection, dogfooding).
- `examples/` — `agentic` (headless reference consumer), `unabridged` (fully commented
  config reference), `outputs` (terrazzo showcase), `schemas` (vocabulary showcase).

## Setup and the gate

```bash
pnpm install
pnpm lint && pnpm test   # the gate — green before any work is called done
```

Lint is Biome (2-space, organized imports): `pnpm format` fixes what `pnpm lint`
complains about. Tests are vitest, run repo-wide from the root.

## Versioning (changesets)

A change that alters a **public** package's shipped behavior adds a changeset **in the same
commit** — a hand-written file, no wizard:

```md
---
"@vertekum/core": patch
---

One changelog-ready sentence: what changed, from a consumer's point of view.
```

Save as `.changeset/<kebab-slug>.md`. The public packages are `@vertekum/core`,
`@vertekum/cli` (these two version linked), `@vertekum/schema-dtcg`,
`@vertekum/schema-atlassian`, `@vertekum/ext-export-terrazzo` — changesets cannot name a
private package. While 0.x: breaking → `minor`, everything else → `patch`. Docs, tests, and
private-only changes need no changeset.

On arcs touching public packages, run `pnpm changeset:status` before calling the work done —
it lists public packages changed on the branch that no changeset covers. A deliberate
no-release change is recorded with `pnpm changeset --empty`. Releasing is a separate,
human-triggered flow: `docs/guide/publishing.md`.

## Conventions

Follow `docs/conventions/` for both human- and agent-written code.

- **UI markup** — `docs/conventions/ui.md`: HTML-first (native elements when they fit),
  custom `vtk-` tags only when needed, `data-vtk-*` for variants/explicit state (CSS-native
  signals first), `name` for form data else prefixed `vtk-` ids. (ADR-0021)

- **Extension surfaces** — an extension package splits into `index.ts` (identity: manifest,
  settings schema, `defineExtension`), `api.ts` (services, route data, `lazyMount` thunk), and
  `ui.tsx` (components + CSS, default-exporting a `LazyView`). **`api.ts` must not import React,
  `.css`, or any `ui` module** — it imports `vertekum/core`, while `ui.tsx` imports `vertekum`.
  Exception: publishable extensions (the export exporters) import `@vertekum/core` directly and
  peer on it — a peer on the private app would make them uninstallable (ADR-0029 amendment).
  A plain-Node spec enforces this; vitest cannot, since it loads CSS through Vite. (ADR-0029)
  `cli.ts` holds contributed CLI commands, registered from `api.ts` by direct import (no thunk —
  it has no React or CSS to defer). A handler mutates `project.document` and returns a
  `CommandResult`; it never prints and never writes files — the runner owns persistence,
  `--dry-run` and `--json`. (ADR-0030 amendment)

- **Headless boot stays headless** — nothing reachable from `api.ts`/core may import React,
  CSS, or a `ui` module. `packages/workbench/cli/scripts/assert-headless.mjs` enforces this
  by importing modules in plain Node (tsx has no CSS loader, so a leak fails loudly). Never
  "fix" a failure there by teaching Node to load CSS — move the import behind the `ui`
  surface instead.

- **Scoped styling** — an extension's CSS is `@scope`-contained in its own file, never
  added to the app's global stylesheet. A package declares its own direct-imported
  dependencies; nothing rides on hoisting.

- **Package doc neutrality** — a publishable package's README and docs never mention the
  Vertekum monorepo, sibling packages' internals, or repo history. Present tense only, in
  the domain's own nomenclature.

## Running it headlessly

`vertekum build`, `check`, and `describe` drive the whole pipeline from Node — no browser,
no server, no React. `describe --json` reports what CAN be configured (registered exporters
and their option schemas, validators, compositions); config files only say what IS. Exit `1`
means the tokens are wrong, `2` means the invocation was. See the README for flags and
ADR-0030 for the contract.

## Testing

- Unit/integration specs are colocated: `foo.ts` → `foo.test.ts(x)`, run by vitest.
- CLI end-to-end specs live in `packages/workbench/cli` (`*.e2e.test.ts`) and drive real
  fixture projects.
- The headless-boundary spec runs `assert-headless.mjs` in plain Node as part of the suite.
- Write tests with the change, not after it; the gate runs the whole suite, not a subset.
