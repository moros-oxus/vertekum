# Working with schemas

A project's vocabulary is enforced by schema files bound in the config — the model is
`@vertekum/core`'s schema documentation; `vertekum describe` lists the bindings in
force with each schema's resolved path. The CLI's part is the workflow around those
files.

## `schema eject`

Copy a schema into the working directory so it can be **changed**. A packaged
vocabulary you cannot edit is not a starting point; ejecting turns "the vocabulary a
package ships" into "the vocabulary this project enforces", after which it is ordinary
source under review.

```bash
vertekum schema eject @vertekum/schema-atlassian/color.json
vertekum schema eject @vertekum/schema-dtcg/format.json schemas/dtcg-format.json
```

| Argument / flag | What it is                                                                              |
| --------------- | ---------------------------------------------------------------------------------------- |
| `<source>`      | A path (`./x.json`) or a package specifier (`@vertekum/schema-dtcg/format.json`) — resolved from the project first, then from the system's own dependencies. |
| `[dest]`        | Where to write it; default `./schemas/<basename>`.                                       |
| `--force`       | Overwrite an existing file at the destination (otherwise: refused, exit `1`).            |
| `--cwd <dir>`   | The directory to eject into.                                                             |

The copy is **byte-verbatim** — the file that was shipped, not a reserialization — so a
later diff against a newer version of the package is meaningful.

The fallback through the system's own dependencies is what makes the bundled format
schemas ejectable: `@vertekum/schema-dtcg` is the kernel's dependency, and a project
should not have to install a package it never imports just to get a copy of a file that
already governs it.

Two things `eject` deliberately does **not** require:

- **A registry.** The source is an explicit path or specifier — the schemas the system
  bundles eject exactly the way a third party's do.
- **A project.** Ejecting works before a config exists — you may be assembling the
  project the schema will belong to.

## Binding the copy back

`eject` prints the config snippet:

```
wrote schemas/color.json
add to vertekum.config.ts:
  { from: './schemas', use: { 'color.json': '<glob>' } }
```

Two intents, one mechanism:

- **Adding a vocabulary** — bind the copy with a glob and (usually) its own `domain`.
- **Replacing a shipped schema** — bind the copy with the original binding's `id`
  (`dtcg-tokens`, `dtcg-resolver`), so it substitutes instead of layering. A moving
  spec becomes a file swap.

The binding fields and their values are `@vertekum/core`'s schema documentation.

## Contributed `schema` subcommands

Extensions may add verbs under `schema` — with `@vertekum/schema-builder` installed,
`vertekum schema build` compiles `.dfn` definition files into JSON Schema. Like every
contributed command, it appears in `--help` and `describe` only when the project
actually installs it ([contributed commands](./contributed-commands.md)).
