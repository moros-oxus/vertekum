# Vertekum 

UI Systematics Management Application.

Create, modify and curate tokens and themes, and manage the export data to other applications and systems.

## What is Vertekum?

Vertekum (`/ˈvɜtɛˈkʊm/` or `/ˈvɜtɛˈkɯ̟m/`) is a portmanteau of three words:

- **Verbund** (German): Means "network," "alliance," or "composite structure". It implies separate entities firmly bound into a singular, stronger system.
- **Tessera** (Greco-Roman): An individual square tile or block used to create a mosaic. It implies a single component that is worthless on its own, but combines with others to build a massive, complex, and beautiful macro-system
- **Kumiko** (Japanese): A traditional woodwork technique where complex, beautiful geometric patterns are created by interlocking tiny, precise wooden pieces without nails. It is the ultimate cultural metaphor for a perfect system built of _tesserae_

**The Concept:** A network (**Ver**bund) of design tokens (**Te**ssera) arranged in a perfect layout grid (**Kum**iko).

## What is UI Systematics?

A branch of UI-Systems that encompases authoring and consuming thematic language and concepts between ui-design and ui-development.


## Commands

Vertekum runs headlessly: `build`, `check`, and `describe` need no browser, no server, and no Vite.
Run them from a directory containing a `vertekum.config.ts` (or any directory beneath it).

```bash
vertekum build                    # run every configured export target and write its files
vertekum build --target web       # only this target (runs it even if `enabled: false`)
vertekum build --dry-run          # print what would be written, write nothing
vertekum build --no-check         # skip the implied validation pass

vertekum check                    # run every registered validator
vertekum check --json             # machine-readable diagnostics

vertekum describe                 # what CAN be configured here
vertekum describe --json          # exporters + their option schemas, validators, compositions

vertekum dev                      # launch the UI (the only long-running command)
```

Extensions contribute commands too. These exist only inside a project, and `describe` lists the ones
available here:

```bash
vertekum token rename color.red.900 color.red.950
vertekum token rename color.red color.danger --allow-group   # a whole group
vertekum token rename color.red.900 color.red.950 --dry-run  # report, change nothing
```

A rename rewrites every reference to the renamed path across every set — so `{color.red.900}` in
another file follows automatically, and `check` stays clean. Every contributed command accepts
`--dry-run` and `--json`.

Every verb takes `--json` and `--cwd <dir>`. **stdout is data, stderr is logs**, so `--json` output
pipes cleanly. Exit codes: `0` success, `1` the work failed or diagnostics contain errors, `2` the
invocation or project is unusable — `1` means your tokens are wrong, `2` means the call was wrong.

`build` runs the validators first and refuses to emit when any diagnostic is an error. Warnings never
block.

Export targets live at the config **root** — a runner concern, owned by no extension — and
any registered exporter can serve them. The same targets drive `vertekum build` and the
Export route:

```ts
import { cssExportExtension } from '@vertekum/ext-export-css';
import { defineConfig } from 'vertekum';

export default defineConfig({
  collection: './tokens',
  extensions: [cssExportExtension],
  targets: [
    { id: 'web', exporter: 'css', composition: 'default', out: 'build/css',
      options: { selector: 'media' } },
  ],
});
```

`composition` names a resolver file; `out` is relative to the config file's directory. Run
`vertekum describe --json` to see which exporters are registered and what options each
accepts. See ADR-0030 for the full contract.
