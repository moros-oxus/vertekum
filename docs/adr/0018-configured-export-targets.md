# 18. Configured, repeatable export targets

Date: 2026-07-02

## Status

Accepted — amended below; targets are now declared at the config root and executed
through the core exporter registry (ADR-0030)

## Context

The export pipeline is ADR-0013 (resolve → transform); its invocation UX was open. Vertekum
is positioned as a Style-Dictionary/Token-Studio-class tool feeding platforms, where exports
are typically repeatable build configuration, not one-off generations.

## Decision

Export is driven by **configured, repeatable export targets**. A target is
`{ exporter, options (e.g. per-axis CSS selector strategy), output path }`, **persisted
in-repo** (config file / `$extensions`). Targets can be run individually or all together, and
later **watched/regenerated on change**. Output is written via the `StorageProvider` — the
local server writes files to the path (ADR-0015); the browser fallback downloads.

## Consequences

- Fits Vertekum's place in a token build pipeline; exports are reproducible and versioned
  with the repo.
- The walking skeleton ships one CSS export target writing to a path.
- Additional exporters (Tailwind, iOS, Android, Figma/Penpot) are added as more targets/
  plugins (ADR-0013, ADR-0014).

## Amendment (2026-08-14): root config and the exporter registry

Targets moved to the **config root** — `defineConfig({ targets })` is the one location for
every project; the `vtk.export` settings fallback is deleted. Exporters register through the
**core exporter registry**; format exporters are peer packages (`@vertekum/ext-export-css`,
the terrazzo bridge), and a core builtin validator (`core.targets`) checks target shape and
options against the declaring exporter's schema. Headless `build` and the Export route run
the same registry.

## Amendment (2026-08-04): the concrete target shape, and a second writer

The headless CLI arc (ADR-0030) gave targets their concrete form. A target is
`{ id?, exporter, composition?, out, options?, enabled? }`, declared at the config **root**
(`defineConfig({ targets })` — originally under `vtk.export` settings, a fallback since deleted):

- `id` defaults to `exporter` and must be unique; it is what `--target` selects.
- `composition` names a resolver document; omitted means flat (all tokens, no resolution).
- `out` is relative to the **project dir** — the config file's directory, the same root the bridge
  writes to. Escaping it is refused by `writeTextFile`.
- `enabled` defaults true. A disabled target is skipped by `build`, but `--target <id>` still runs it,
  since naming one is explicit intent.

`Exporter` gained an optional `optionsSchema` (Zod). The exporter owns and declares the meaning of
`options` while the target shape stays fixed: `check` validates a target against the declaring
exporter's schema, and `describe` publishes it, so an agent can configure a third-party exporter it
has never seen without reading its source.

The CLI joins the bridge as a **second writer of the same artifacts** — both call
`writeTextFile(projectDir, …)`, so files land identically whether a human clicks Run in the export
route or CI runs `vertekum build`. Both also resolve through the same pure `runTargets` in core.

## Amendment (2026-07-25): opt-in git release write

The Release feature (semantic diff → bump → changelog) added a **git ReleaseProvider** beside the
lock-file one, selected by `vtk.release` config (`provider: 'lock' | 'git'`). Its baseline is the
token collection at the last version tag (read-only git). Its **default write stays hands-off** — it
writes the changelog and leaves the commit and tag to the user, exactly as the lock provider does.
Only when explicitly opted in via `providerOptions` (`commit` / `tag` / `bumpPackage`, each an
independent flag) does the app create the release commit, the annotated `v<version>` tag, and the
`package.json` bump. `commit` may be a function that builds the message from the release info. The
opt-in is the sole path by which the app writes to git history; nothing happens to the repo without it.
