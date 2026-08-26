# The CLI contract

Every `vertekum` verb — built-in or contributed — behaves by one set of rules. This page
is those rules; the per-verb pages only add what is specific to each verb. The binary
installs under two names, `vertekum` and the shorthand `vtk` — they are the same program.

## Exit codes

| Code | Meaning                                                                                  |
| ---- | ---------------------------------------------------------------------------------------- |
| `0`  | Clean.                                                                                    |
| `1`  | The **tokens** are wrong — diagnostics, a refused build, a verb that could not act. Fix the collection. |
| `2`  | The **invocation** was wrong — no config found, unknown target, usage error. Fix the command. |

The split is the promise: an agent (or a script) can tell "my change is bad" from "my
command is bad" without parsing messages.

## Output streams

**stdout is data, stderr is logs.** Diagnostics on a refused build, progress notices, and
error explanations go to stderr; `--json` payloads and printed results go to stdout — so
`vertekum check --json | jq .` always parses.

## Shared flags

These are owned by the **runner**, uniformly — a contributed command cannot opt out of
them or implement them differently:

| Flag          | On                     | What it does                                                          |
| ------------- | ---------------------- | --------------------------------------------------------------------- |
| `--json`      | reporting + mutating verbs | Machine-readable output on stdout.                                 |
| `--dry-run`   | mutating verbs         | Compute and report everything; write nothing.                          |
| `--cwd <dir>` | every verb             | Run as if invoked from `<dir>` (project discovery starts there).       |

## Project discovery

The config file's directory is the **working directory** — the token collection, export
output, and the system-governed `.vertekum/` directory all resolve relative to it.

1. Starting at `--cwd` (default: the current directory), the CLI walks **up** through
   ancestors looking for `vertekum.config.ts` (also `.js` / `.mjs`). The nearest one
   wins — repo root in a single-repo, package root in a monorepo.
2. With a config found, it is evaluated (`command: 'build'`), the extension graph
   activates headlessly, and the collection loads from disk. No UI module is ever
   evaluated.
3. With **no** config, the working directory is inferred: the nearest ancestor carrying
   a `.git` directory or a `pnpm-workspace.yaml`, else `--cwd` itself. The system runs
   on defaults, and the collection is assumed at `<working dir>/tokens`.

Verbs that need a project and find none exit `2` with `no vertekum config found`. Two
verbs are deliberately exempt and never load a project: `init` (it runs where no project
exists yet) and `dev` (it loads its own config through the app). `schema eject` loads
the project when one exists but also works without one — see
[schemas](./schemas.md#schema-eject).

## Honest help

`--help` and `vertekum describe` list contributed commands only when the loaded project
actually installs the extensions that provide them. Help outside a project shows only
the built-ins — what you see is what you can run *here*.

## `vertekum dev`

Launches the Vertekum browser app (Vite + the local bridge server). The app is an
**optional peer** (`vertekum` + `@vertekum/server` + `vite`): without it installed, `dev`
exits `2` with a clear message and every other verb works normally. Everything else in
this documentation is fully headless.
