# Vertekum — overview

> **Status: headless-first.** Vertekum is built as a headless, config-driven capability —
> tokens in, composed and validated output out — with a browser app as a thin layer over
> the same core (currently deferred). This guide is written for users and consumers of the
> system, not just contributors.

## What Vertekum is

Vertekum is a **UI systematics** management application: create, modify, and curate design
tokens and themes, and export them to the applications and platforms that consume them. It
is **local-first** — your tokens live in your files / git repo, and Vertekum runs on top of
them (see "Running locally").

## Core concepts

- **Design token** — one named design decision (a color, a dimension…), stored in the
  [W3C DTCG](https://tr.designtokens.org/format/) format.
- **Collection** — the set of DTCG files that make up one token document.
- **Token set** — one DTCG token file; the unit a resolver composes.
- **Resolver / composition** — a resolver document (the DTCG Resolver Module) declares
  which sets compose and which **contexts** (e.g. `theme: light|dark`) swap alternatives
  in. A **composition** is a named resolver file — the thing exports and checks run
  against.
- **Export target** — a repeatable configuration that transforms the tokens into a specific
  output (CSS variables, Tailwind, iOS, Android, Figma…).
- **Consumer** — a downstream target: **design tools** (Figma/Penpot, round-trippable) or
  **platforms** (CSS, native — terminal outputs).

See the glossary in [`CONTEXT.md`](../../CONTEXT.md) for the full vocabulary, and
[`docs/adr/`](../adr/) for the decisions behind the design.

## Running headlessly

Everything runs from Node — no browser, no server. From any directory at or under a
`vertekum.config.ts`:

```bash
vertekum build      # run every configured export target
vertekum check      # run every validator; --json for machine-readable diagnostics
vertekum describe   # what CAN be configured here (exporters, validators, compositions)
```

Every verb takes `--json`; exit `0` is success, `1` means the tokens are wrong, `2` means
the invocation was. The README documents the full command set; `examples/agentic` is a
complete headless consumer.

## Running locally

```
pnpm install
pnpm dev
```

`pnpm dev` runs `vertekum dev` against the reference consumer in `examples/unabridged`. It starts the
local bridge server (which reads/writes your token files) plus the app, and opens the printed URL.

### How a consumer is configured

Vertekum is used as a dependency in your repo. A `vertekum.config.ts` marks the **working directory**
— the repo root for a single repo, a package root in a monorepo — and everything the system manages
resolves relative to it:

```
<working-dir>/
  vertekum.config.ts    # defines the collection + which extensions load
  tokens/               # your DTCG token files (the collection)
  build/                # export outputs (user-defined)
  .vertekum/            # system-governed only: per-user settings, release lock, CHANGELOG
```

The app ships a `defaultConfig`; your config **overrides** it (the system merges the two), so a
config need only carry what it changes — e.g. `defineConfig({ collection: './tokens' })`. Running
`vertekum dev` walks up from the current dir to find the nearest `vertekum.config.ts`; with none, it
falls back to the repo root using `defaultConfig` alone. See `examples/unabridged/vertekum.config.ts`
for a fully explicit, commented reference, and `packages/ui-system/primitives` for a real in-repo
consumer.
