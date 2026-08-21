# `vertekum schema build`

Build `.dfn` modules into the JSON Schema files the `schemas` config binds. The command
is contributed by this extension — it exists once `schemaBuilderExtension` is in the
project's config, and appears in `vertekum --help` and `vertekum describe` from then on.

```bash
# vertekum schema build [module] [--check] [--dry-run] [--json] [--cwd <dir>]
vertekum schema build                       # every module under ./schemas
vertekum schema build schemas/color.dfn     # one module
vertekum schema build --check               # CI: verify nothing is stale
```

| Argument / flag | What it does                                                                 |
| --------------- | ----------------------------------------------------------------------------- |
| `[module]`      | A `.dfn` file, relative to the working directory. Default: the sweep (below). |
| `--check`       | Verify the built files on disk are current; write nothing.                    |
| `--dry-run`     | Report what would be written without writing — owned by the runner, like every contributed command (see `@vertekum/cli`'s documentation). |
| `--json`        | Machine-readable result (`files`, plus `skipped` and `fragments` under `data`). |
| `--cwd <dir>`   | Project discovery starts here.                                                |

## The sweep

With no argument, every `.dfn` under the project's `schemas/` directory builds —
recursively, so nested module directories are included (`node_modules` is not).
Modules without a `root` are **fragments**: the sweep skips them with a notice, while
naming one explicitly is an error — see [modules](./modules.md#fragments).

## Artifacts

Each module builds to `<module-name>.json` **beside its own file** —
`schemas/color.dfn` → `schemas/color.json`, `schemas/palette/color.dfn` →
`schemas/palette/color.json`. What the file contains is [emission](./emission.md).

Writing goes through the CLI runner: `--dry-run` lists the same files and writes
nothing, and an artifact path can never escape the working directory.

## Ownership: the stamp

Every built file carries a `$comment` stamp naming its source module:

```
built by @vertekum/schema-builder from schemas/color.dfn — do not hand-edit; remove this comment to take ownership
```

The stamp is the contract:

- A **stamped** file is the builder's — regenerated on every build.
- A **stampless** file at a build target has been taken over: hand-edit the JSON and
  delete the stamp line, and the builder skips it from then on — reported
  (`… has local edits (no stamp) — left as is`), never overwritten silently.

## `--check`: the staleness gate

`--check` rebuilds in memory and compares against disk, writing nothing. Any
difference is an error (exit `1`) naming the stale files:

```
stale built schemas: schemas/color.json — run `vertekum schema build`
```

This is the CI guard: run it wherever the built schemas are committed, and a grammar
edit that forgot its rebuild cannot land.

## Programmatic use

The pipeline is importable from `@vertekum/schema-builder/api` for tooling that wants
the pieces directly:

| Export                     | Does                                                             |
| -------------------------- | ----------------------------------------------------------------- |
| `parse(source)`            | `.dfn` text → the module AST.                                     |
| `resolveModule(path)`      | Parse a file and, recursively, everything it `use`s.              |
| `build(resolved)`          | Expand a resolved module's root into its name tree.               |
| `emit(tree, options)`      | Name tree → the JSON Schema document text.                        |
| `buildModule(path, label?)`| The whole pipeline: path in, `{ target, content }` out.           |
| `isStamped(content)` / `stamp(moduleFile)` | The ownership-stamp helpers.                      |
