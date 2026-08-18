# Context: Design Tokens

The domain glossary for Vertekum. Skills and agents read this before exploring the
codebase and use these terms — not synonyms — when naming concepts in issues,
refactors, hypotheses, and tests.

> **Status: built, headless-first.** The core packages live under
> `packages/workbench/*` (@vertekum/core, @vertekum/server, @vertekum/cli, and the `vertekum` app umbrella) and the design system under
> `packages/ui-system/*` (@vertekum-ui/react, @vertekum-ui/primitives). The DTCG vocabulary is grounded in
> the README and the
> [W3C Design Tokens Community Group (DTCG) format](https://tr.designtokens.org/format/).
> Decisions are recorded in `docs/adr/` (ADRs 0001–0031). Vertekum is a headless,
> config-driven capability first — `vertekum build` / `check` / `describe` drive the whole
> pipeline from Node — and the browser app is a thin layer over the same core, currently
> deferred.

## What Vertekum is

Vertekum is a **UI systematics** management application: it lets users create, modify,
and curate design tokens and themes, and manage the export of that data to other
applications and systems. The name encodes the shape of the domain — a **network**
(_Verbund_) of design tokens (_Tessera_) arranged in a layout **grid** (_Kumiko_).

## Core vocabulary (DTCG)

We follow the W3C DTCG format. Use these terms as defined there; the notes below fix
how they apply here.

- **Design token** — A named entity storing one indivisible design decision. Concretely,
  a JSON object with a `$value` and (usually) a `$type`. This is the _Tessera_ of the
  Vertekum metaphor.
- **Token name** — The key identifying a token within its group. The fully-qualified
  path (group names joined to the token name) uniquely identifies a token.
- **`$value`** — The token's value. Either a concrete value (e.g. `#ff0000`, `16`) or a
  **reference** to another token.
- **`$type`** — The token's type, which determines how `$value` is interpreted and
  validated. DTCG types include `color`, `dimension`, `fontFamily`, `fontWeight`,
  `duration`, `cubicBezier`, and `number`.
- **Reference (alias)** — A `$value` written as `{group.subgroup.token}` that points at
  another token instead of holding a literal. Resolving a reference chain to a concrete
  value is **resolution**; a reference that points back at itself (directly or
  transitively) is a **cycle** and is invalid.
- **JSON Pointer reference (pointer)** — The second reference form: a `$ref` (RFC 6901)
  in token position (instead of `$value`) or as a `{"$ref"}` object in value position,
  able to extract **fragments** of values (`#/color/brand/$value/components/2`). Pointers
  resolve against the **composed document**, like aliases.
  (`docs/guide/pointer-references.md`)
- **`$root`** — The 2025.10 reserved token name giving a group its own base value
  (`color.text` and `color.text.subtle` via `text: { $root, subtle }`). A name segment
  like any other; it must never survive into an exported name or alias.
- **Value object** — The 2025.10 object notations for values: color as
  `{ colorSpace, components, alpha, hex }`, dimension as `{ value, unit }`. Authored
  notation is preserved on round-trip. (`docs/guide/value-notation.md`)
- **Token set** — One DTCG token file. Sets are the unit a resolver composes; a
  collection is the folder of sets plus resolver and schema files.
- **Group** — A nestable namespace of tokens and sub-groups. Groups organize tokens and
  form the dotted path used in references. A group is not itself a token.
- **Composite token** — A token whose `$value` is an object of named sub-values (e.g.
  `typography`, `shadow`, `border`, `gradient`, `transition`), each of which may itself
  be a reference.
- **`$description`** — Human-readable prose attached to a token or group. Documentation,
  not a value.
- **`$extensions`** — Vendor-namespaced metadata on a token or group. Where Vertekum-
  specific data that isn't part of the DTCG format is stored — notably the **token ID**
  under the reverse-DNS key `org.vertekum` (see Architecture; ADR-0005, ADR-0020).
  Foreign vendor keys round-trip untouched.

## Vertekum concepts

Terms Vertekum adds on top of the DTCG format. The theme/export model is now decided (see
the ADRs cited); their finer details will still firm up as code lands.

- **Theme / composition** — Theme composition is owned by **resolver documents** (the DTCG
  Resolver Module): a resolver file declares **sets** (references to token files) and
  **modifiers** whose **contexts** select alternative sets (light/dark, brand, …). A
  **composition** is a named resolver file; there are no per-token theme overrides. (ADR-0031)
- **Composed document** — The result of flattening a resolver's resolution order for one
  context selection. References (curly aliases and `$ref` pointers) resolve against the
  composed document; exporters and validators consume composed bundles, per composition.
  (ADR-0031)
- **Export** — A **two-stage** pipeline: *resolve* (theme-aware, shared) then *transform*
  (target-specific: subset, rename, serialize). (ADR-0013)
- **Export target** — A persisted, repeatable export config:
  `{ id?, exporter, composition?, out, options?, enabled? }`, declared at the config
  **root** (`defineConfig({ targets })`). `vertekum build` and the Export route run the
  same targets; writing goes through `writeTextFile` — Node fs for the CLI, the bridge
  for the browser. (ADR-0018, ADR-0030)
- **Schema files** — Files-first token schemas: a project names schema files
  (`schemas` config) that pin vocabulary and order over chosen sets — the
  **names-and-order** model, with curation and eject-and-edit. Lives in core (the
  `schemas` config + validator) with `@vertekum/schema-*` packages. (`docs/guide/token-schemas.md`)
- **Value notation / codec** — Values are stored in the notation they were authored in;
  codecs convert per type, `defaultColorSpace` sets the project's color space, and
  `vertekum migrate values` rewrites notations deliberately.
  (`docs/guide/value-notation.md`)
- **Release** — Semantic diff of the collection → version bump → changelog, through a
  pluggable ReleaseProvider (`lock` file or `git` tags; config-selected). Writes to git
  history only on explicit opt-in.
- **Consumer** — A downstream target of export, split by directionality: **design targets**
  (Figma/Penpot) are round-trippable; **platform/build targets** (CSS, Tailwind, iOS,
  Android) are terminal. (ADR-0013, ADR-0014)
- **Design-tool bridge** — A cross-runtime integration: a Vertekum-side Importer/Exporter
  plugin plus an optional host-side **companion** that preserves stripped metadata (ids,
  `$extensions`) via a **sidecar-metadata contract**. (ADR-0014)

## Architecture

Terms fixed by the system-architecture decisions in `docs/adr/`. Unlike the Vertekum
concepts above, these are settled.

- **App tokens vs. document tokens** — the UI kit's own chrome design system (**app
  tokens**, `@vertekum-ui/react`) versus the tokens the user edits and curates
  (**document tokens**). Two disjoint namespaces; document tokens never style the app.
  There is no live token preview. (ADR-0002)
- **Document** — a multi-file **collection** of DTCG files loaded, synced, and merged as one
  unit. The unit of everything below. (ADR-0006)
- **Collection** — the folder/set of DTCG files that make up a document. (ADR-0006)
- **Working copy** — the in-browser (IndexedDB/OPFS) live state of a document during a
  session; files are the interchange artifact. (ADR-0003)
- **Sync** — the reconcile operation between the working copy and the files. Import seeds or
  updates the working copy; export publishes it. Git-style: the two are peers. (ADR-0004)
  Surfaced to the user as a single **unified Sync** action (write → commit → pull + 3-way
  merge → push) with progressive disclosure of git controls. (ADR-0019)
- **Merge base** — the last-synced snapshot of the collection, persisted so divergence can
  be detected by a 3-way merge (no-op / fast-forward / conflict). (ADR-0004)
- **Token ID** — a stable identifier for a token, independent of its path, stored under the
  `$extensions` key **`org.vertekum.ident`**. Vertekum namespaces `$extensions` under the
  reverse-DNS root `org.vertekum` (configurable later), each sub-key named for its premise:
  `.ident` for identity, `.meta` for other per-token metadata (future concerns get their
  own). Minted deterministically from a token's path (segments joined with `.`,
  which DTCG reserves) when absent; existing IDs are preserved. Renames/moves are tracked by
  ID across merges. (ADR-0005, ADR-0020)

## Application architecture

The app design, fixed by the ADRs cited. `vertekum` (the app package) is a local-first browser SPA with
no backend in Scenarios 1–3. (The app layer is currently deferred; the design record
stands.)

- **Run modes / deployment ladder** — S1 embedded (Storybook-like) → S2 dedicated tokens
  repo → S3 hosted (git-pages/container) → S4 SaaS/paid (may add a backend). Git-host auth
  is client-side; there is no Vertekum backend in S1–S3. (ADR-0007)
- **StorageProvider** — the pluggable sync target behind the working copy: local git
  (isomorphic-git + File System Access), local files, or host adapters (GitHub/GitLab OAuth);
  optional generic git-over-CORS-proxy for other remotes. Trusted tier. (ADR-0008)
- **Local bridge server** — a thin local Node process (single-user localhost helper, not a
  hosted backend) exposing filesystem + git as the **default StorageProvider for local run
  modes** (S1/S2/S3-container); dissolves the FSA-permission and remote-CORS-proxy problems
  there. Static/hosted contexts fall back to browser providers. (ADR-0015)
- **Config resolution & dev entry points** — Vertekum installs as a dependency; a
  `vertekum.config.ts` marks the **working directory** (repo root for a single repo, package
  root in a monorepo). `vertekum dev` is the one entry point: the `vertekum` bin
  (`vertekum` → `@vertekum/cli`) walks up from cwd to the nearest config (else infers the repo root
  via `.git`/`pnpm-workspace.yaml` and uses `defaultConfig` alone). The bridge is **dual-root**:
  token files at the config's `collection`, but `.vertekum/` (system-governed only: per-user
  settings, release lock, CHANGELOG) and export outputs at the working dir. The app ships a
  `defaultConfig`; a repo's config **overrides** it (the system merges via `mergeVertekumConfig`),
  so a config need only carry its changes. `examples/unabridged` is the explicit reference consumer;
  `packages/ui-system/primitives` is the real in-repo one. (ADR-0015, ADR-0025/0030)
- **Kernel** — the thin core: extension host, event/hook bus, sandbox runtime, document
  store, and core interfaces. Most features ship as first-party **HostExtensions** on the
  public API. (ADR-0009)
- **Kernel shell & slot** — the shell owns persistent chrome via base **slots**: **ribbon**
  (command/nav rail), **toolbar**, **main** (the active-route outlet), **statusBar**. A
  **slot** is a named region contributions render into. The registry is **open/recursive**:
  trusted HostExtensions may define new namespaced slots; sandboxed/cheap plugins only fill.
  (ADR-0016, ADR-0022)
- **Route registry** — the kernel registers routes; a HostExtension may contribute a route
  subtree (mounts into `main`), an optional **ribbon entry** (nav link to its route), and its
  own sub-slots. TanStack Router drives it in the app shell and is never imported by route
  plugins. (ADR-0022)
- **Service registry & resilience** — extensions publish/consume services by key on the
  context (contract defined in `@vertekum/core`, e.g. `VALIDATOR_SERVICE`), so they
  collaborate without importing each other. **Soft dependencies** degrade gracefully when
  a service is absent (Tokens still edits token values with a peer extension gone), and an
  **error boundary** around each extension mount contains crashes. (ADR-0022, ADR-0023)
- **UI boundary** — a slot mounts a DOM node/custom element via a framework-agnostic
  **`mount(element, context)`** contract. First-party UI uses **React** (routing via
  **TanStack Router**); the plugin ecosystem is never locked to a framework. (ADR-0017)
- **HostExtension** — a trusted plugin; the primary extension surface. Contributes any of
  several **optional capabilities**: routes (+ ribbon entry), commands, settings, views,
  storage, services, etc. **Non-view** extensions (no route/ribbon) are surfaced via the
  **Extensions & Settings** area. (ADR-0009, ADR-0010, ADR-0022)
- **Plugin tiers** — **cheap** (event/hook bus subscribers), **sandboxed** (pure data-in/
  data-out in a Web Worker: transforms, token ops, resolution, exporters), and **trusted**
  (HostExtensions). (ADR-0010)
- **Extension point** — a typed plugin kind: `StorageProvider`, `Transformer/Exporter`,
  `TokenOperation`, `ValueEditor`, `SchemaProvider/Validator`, `HostExtension`.
  (ADR-0010, ADR-0028)
- **Value editor** — a per-`$type` editor extension point via a service registry
  (first-party color/dimension/number editors; more via plugins). An editor edits a
  single value and is theme-agnostic — the view supplies the value from the composed
  document. (ADR-0028)
- **Plugin (distribution)** — an npm package + in-package manifest (kind, tier, capabilities).
  Composed at build-time in S1–S3; loaded from a static runtime registry in S4. (ADR-0011)
- **Command / normalized store** — the kernel owns a normalized document (tokens by ID, group
  tree, `$extensions`); extensions mutate only via commands; undo/redo and the merge base
  derive from the command log; sandboxed plugins get snapshot-in / patch-out. (ADR-0012)
- **Extension surfaces** — an extension package splits into `index` (identity), `api` (its
  registry of methods: functions plus the activation that publishes them as services), and `ui`
  (components + CSS). `api` imports `vertekum/core` and never React; the view sits behind a
  `lazyMount` thunk on the route's `mount`, so a headless boot never evaluates it. `cli` is
  declared and lands with extension-contributed commands. (ADR-0029)
- **Run model** — `runTargets(targets, { registry, tokens, resolvers })` in core: pure, no
  filesystem, resolving each target's composition and calling its exporter. The CLI and the
  Export route are both callers, which is what stops them drifting. Writing is the shell —
  Node `fs` for the CLI, the bridge for the browser, both via `writeTextFile`. (ADR-0018, ADR-0030)
- **Verbs over registered kinds** — extensions register capability *kinds* (exporter,
  validator); config declares configured *instances*; `build` / `check` / `describe` execute
  them. Config is the API agents use, and the GUI is a config editor over the same settings.
  (ADR-0030)
- **Diagnostic** — one machine-readable problem: `{ code, severity, message, source, file?,
  target? }`, codes namespaced `<domain>/<name>`. Every validator speaks this vocabulary, so
  `check --json` is what lets an agent correct itself rather than only produce. (ADR-0030)

## Built and deferred

What has shipped, and what is intentionally parked. Threads are flagged in the relevant
ADRs and guides so they aren't lost.

**Built:**

- **Headless CLI** — `build` / `check` / `describe` plus extension-contributed commands
  (`token rename`, `token add/set`, `migrate values`); `--json` everywhere, diagnostics as
  the shared vocabulary. (ADR-0030)
- **Resolver composition** — resolver documents as theme truth; structure- and value-level
  resolution; per-composition validation. (ADR-0031)
- **Core validation** — references (aliases + pointers + type mismatches), resolver
  semantics, and target shapes run as core builtins with zero extensions installed.
- **Schema layer** — files-first schemas with curation and eject-and-edit; core-resident,
  with `@vertekum/schema-*` packages. (`docs/guide/token-schemas.md`)
- **Exporter registry** — registry in core; format exporters as peer packages
  (`@vertekum/ext-export-css`, the terrazzo bridge as file hand-off). (ADR-0018)
- **Value notation, pointer references, `$root`** — 2025.10 object values with codecs;
  RFC 6901 `$ref` support; `$root` handling end to end. (guides)
- **Release** — semantic diff → bump → changelog via lock/git ReleaseProviders.
- **Config engine + extension framework** — manifest/activate contract, three-tier config,
  consumer projects via `vertekum.config.ts`. (ADRs 0024–0026)
- **Editing core** — multi-file write-back, reference-safe rename, undo coalescing,
  per-`$type` value-editor registry. (ADR-0028)

**Deferred:**

- **The browser app and all UI-only extensions** — standing ruling: no effort applied;
  core absorbs any capability it needs. This parks the editing-panel polish,
  object-notation value editors, options UI, and the browser host's root-config plumbing.
- **Design-tool bridge / companion** (ADR-0014); **runtime plugins & marketplace**
  (ADR-0011 S4); **git/remote providers + conflict UI** in the app; **group `$extends`**
  (DTCG §6.4); **hosted/org-default config overrides**; **sandbox-tier enforcement**
  (arrives with runtime install, ADR-0010).

## Conventions

- When output names a domain concept, use the term as defined above. Don't drift to
  synonyms: **reference** is the umbrella term, an **alias** is the curly form and a
  **pointer** the `$ref` form; a token is a **token**, never a "variable".
- If a concept you need isn't here, that's a signal: either you're inventing language
  the project doesn't use (reconsider), or there's a real gap — add the term here.
- Architectural decisions that touch this domain belong in `docs/adr/`. If output
  contradicts an existing ADR, surface it rather than silently overriding it.
