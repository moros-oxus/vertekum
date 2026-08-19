# 30. The headless CLI contract

Date: 2026-08-04

## Status

Accepted

## Context

Vertekum is a headless, config-driven capability with the GUI as an added layer: agents, CI, and
humans are clients of one core. What was missing was not a CLI but a **run model** — config declaring
what work exists, and one executor that every driver invokes. That logic lived in `ExportRoute.tsx`:
interactive, React-bound, unreachable from Node.

## Decision

**Files are the API; the run model is the product.** The substrate stays plain files in the repo —
token sets, resolver documents, config — so traceability and versioning stay git-native and agents
edit them with the tools they are already good at. Vertekum adds a run model plus structured
diagnostics, so an agent can correct itself rather than only produce.

**Verbs over registered kinds.** Extensions register capability *kinds* (exporter, validator); config
declares configured *instances*; a fixed verb set executes them. Export targets live in `vtk.export`'s
settings, so they are edited by the same tier-2 path the settings UI uses. A separate `pipeline` or
`tasks` block was rejected: it would be a second selection mechanism beside `extensions` that can
disagree with it, bypass the inline-options model, and need its own editor.

**Three verbs**, built on `loadProject(cwd)` — which finds the config, resolves it with
`command: 'build'`, activates the extension graph in Node, and loads the collection:

| Verb | Flags |
| --- | --- |
| `build` | `--target <id...>`, `--dry-run`, `--no-check`, `--json`, `--cwd` |
| `check` | `--json`, `--cwd` |
| `describe` | `--json`, `--with-ui`, `--cwd` |

`dev` remains, as the only long-running command and the only one that loads Vite — imported lazily
inside it.

**`build` implies `check`.** Errors block; warnings never do; `--no-check` overrides. An agent that
only knows `build` must not be able to emit output from a broken collection.

**Diagnostics** are `{ code, severity, message, source, file?, target? }`, with codes namespaced
`<domain>/<name>`. Existing `ResolverIssueCode` values are prefixed `resolver/`, so the vocabulary the
resolver arc designed became the public contract rather than something new.

**Exit codes**: `0` success, `1` the work failed or diagnostics contain errors, `2` the invocation or
project is unusable. The split matters to an agent: `1` means the tokens are wrong, `2` means the call
was wrong.

**stdout is data, stderr is logs and errors**, so `--json` stays pipeable.

`describe` reports what *can* be configured — registered exporters with their option schemas,
validators, compositions, resolved project paths — because availability is decided at activation by
code inside packages and no file answers it. Configured targets are deliberately not echoed back;
they are readable from the config file.

Commander owns dispatch. Its `Command` is a composable object, so an extension's `cli.ts` can return
a subtree the host attaches with one call — the shape extension-contributed commands will need.

## Consequences

- CI is `vertekum check --json && vertekum build`; neither loads a browser, a server, or React.
- The GUI's export route calls the same `runTargets` as `build`, so "Run web" and
  `vertekum build --target web` cannot drift.
- The token schema/grammar arc plugs into `check` by registering a validator, with no CLI change.
- Every invocation transpiles the config graph through `tsx`. Acceptable for `build`; a project that
  cares can shed extensions via the config's function form on `command === 'build'`.
- Extension-contributed commands, mutation verbs, watch mode, binary outputs, and MCP are explicitly
  out of scope and land later.

## Amendment (2026-08-06): the command contribution contract

Extensions contribute commands through a **framework-neutral `CommandDescriptor`** registered on
`ctx.commands`, which the host maps onto commander:

```ts
{ name, description, args?, options?, run(ctx): void | CommandResult | Promise<…> }
```

**This revises what this ADR originally predicted** — that an extension's `cli.ts` would return a
commander `Command` subtree the host attached. That was written before there was a caller. Returning
commander objects would make the CLI framework **public API**: every extension would import it and be
pinned to the host's major version, and swapping it would be a breaking change across the ecosystem.
ADR-0017 rejects exactly this for the UI boundary — `MountFn` hands a route a DOM element, not React —
and the same reasoning applies here. Commander stays an implementation detail of one file.

- **Names are space-separated paths.** `'token rename'` becomes `vertekum token rename`, with parent
  commands created on demand. The registry throws on a duplicate name, so a collision is a startup
  error rather than one command silently shadowing another. Names are not derived from extension ids:
  derivation is magic and collides for third parties anyway.
- **The runner owns persistence, `--dry-run` and `--json`.** A handler mutates `project.document` and
  returns a `CommandResult`; it never prints and never writes files. The runner notices the document
  version changed, serializes, and writes — so no handler implements those flags and a third-party
  command cannot invent its own write path. Dry-run reports which files *would* change by comparing
  serialized before/after, which works for a command the runner knows nothing about.
- **The project loads once**, and `Project` holds **no token snapshots** — once a command can mutate,
  a snapshot taken at load is stale for everything downstream. Callers read `project.document`.
  `serializeDocument` in core is shared by the StorageProvider and the CLI, so browser and CLI writes
  are byte-identical.
- **No implicit `check`.** Unlike `build`, a mutation may be the thing that *fixes* a broken
  collection, so pre-checking would block the repair.
- **Contributed commands exist only inside a project.** `vertekum --help` outside one lists the
  built-in verbs and nothing else, and `describe --json` reports the commands available here.
- Registrations are attributed to their extension (ADR-0027), so `getExtensions()` reports them
  alongside routes and services.

## Amendment (2026-08-19): declared file artifacts

Some contributed commands produce files that are not token documents — the schema builder
emits built JSON Schema files. The rule that a handler never writes stands; what changes is
that a `CommandResult` may now DECLARE artifacts: `files?: Array<{ path, content }>`, paths
relative to the working directory. The runner writes them after the mutation gate — so
`--dry-run` lists them unwritten, `--json` carries them, and a path resolving outside the
working directory is refused with exit `2`. Persistence stays owned in one place; a
third-party command still cannot invent its own write path.
