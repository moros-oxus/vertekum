# Contributed commands

Extensions can contribute CLI verbs. A configured project might expose
`vertekum schema build` (from `@vertekum/schema-builder`) or verbs of its own — the
command table is not fixed by this package.

## How they surface

Contributed commands exist only when the loaded project installs the extensions that
provide them: they appear in `--help` and in [`describe`](./describe.md)'s `commands`
list for that project, and nowhere else. Help is honest about what is available *here* —
which is also why `--help` outside a project shows only the built-ins.

A command's name may be spaced (`token rename`, `schema build`); the CLI builds the
subcommand tree automatically, merging with built-in parents (`schema build` sits
beside `schema eject`).

## What the runner guarantees

Contributed commands run under the same [runner model](./curation.md#the-runner-model)
as the built-in curation verbs — none of this is left to the extension author:

- **`--dry-run`, `--json`, `--cwd`** are attached to every contributed command by the
  runner and behave identically everywhere.
- **Persistence is the runner's.** A handler mutates the in-memory document; the runner
  saves the changed collection files afterwards. With `--dry-run`, it reports the same
  files and writes nothing.
- **No new errors.** After the mutation, the runner re-validates and refuses a change
  that would introduce an error that was not there before — pre-existing problems do
  not block.
- **Declared artifacts, confined.** A command that produces files beyond the collection
  (a built schema, a report) *declares* them in its result; the runner writes them, and
  refuses any path that resolves outside the working directory (exit `2`).
- **Uniform reporting.** `--json` yields `{ ok, command, dryRun, files, data }` — `files`
  lists everything written (or would-be written), `data` is the command's own structured
  result. A handler error yields `{ ok: false, command, error }` and exit `1`.

The practical consequence: an agent can run a third-party verb it has never seen —
discovered via `describe`, previewed with `--dry-run`, parsed via `--json` — with the
same confidence as a built-in.

## Authoring one

A contributed command is part of an extension (the full contract lives with
`@vertekum/core`): the extension registers a **descriptor** — `name`, `description`,
`args`, `options`, and a `run` handler — through its activation context. The handler:

- receives `{ project, args, options }`,
- mutates `project.document` for collection changes and/or returns a result
  (`{ summary, data, files }`) — `files` entries are `{ path, content }`, relative to
  the working directory,
- **never prints and never writes** — output and persistence belong to the runner,
- throws to refuse, with a message that says why (the runner turns it into exit `1`).

Keeping handlers pure like this is exactly what makes the guarantees above hold for
every command, whoever wrote it.
