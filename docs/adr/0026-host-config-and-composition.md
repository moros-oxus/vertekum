# 26. Host config and composition

Date: 2026-07-03

## Status

Accepted — implements the host-config decisions of the design spec
`2026-07-03-extension-framework-and-config` (process archive, outside the repo)

## Context

Per-extension settings (ADR-0025) can express "override this value," but not
"replace this extension" or "don't load that one." That decision — which
extensions load, and project-level overrides to their settings — needs a tier above
settings, and the walking skeleton had it hardcoded as a literal array in `main.tsx`.

## Decision

- **`vertekum.config.ts` + `defineConfig`** is the composition/override tier: code +
  data, the analog of `vite.config.ts`. `defineConfig` (`packages/workbench/app/src/
  config/defineConfig.ts`) is an identity function typed as `VertekumConfig` —
  `{ extensions: Extension[]; settings?: Record<string, Record<string, unknown>> }` —
  giving authors type-checked authoring with no runtime magic.
- It's **code, not JSON**, because swapping an extension means referencing a module
  (`import { myExtension } from './my-extension'`), the same reason `vite.config.ts`
  imports plugins rather than naming them as strings.
- **It decides which extensions load** (`extensions: Extension[]`) and **supplies
  tier-2 setting overrides** (`settings`, keyed by extension id), feeding both into
  the kernel at startup. It **replaces the hardcoded extension list** that used to
  live in `main.tsx`; the in-repo `vertekum.config.ts`
  (`packages/workbench/app/src/vertekum.config.ts`) now composes the four first-party
  extensions (dashboard, themes, tokens, export).
- **Per-collection persistence of user overrides follows from this being a project
  file.** Because `vertekum.config.ts` and tier-2 overrides travel with the project,
  tier-3 user overrides are likewise stored per-collection (`.vertekum/settings.json`,
  ADR-0025), not per-machine.

## Consequences

- Adding, removing, or replacing a first-party or custom extension is now a one-line
  edit to `vertekum.config.ts`, not a code change to the app shell.
- **Loading `vertekum.config.ts` from an arbitrary consumer project** (as opposed to
  the in-repo file imported directly by `main.tsx`) is a noted **seam**: the
  resolution/discovery mechanism for a real host project is deferred until
  distribution to consumer projects is real.
- Host-config overrides are a *starting default* a user can override at tier 3
  (ADR-0025); `vertekum.config.ts` cannot pin a value against a live user edit.
