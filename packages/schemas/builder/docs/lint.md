# `vertekum schema lint`

Validate the `.dfn` sources themselves — fragments included, every production evaluated —
without building anything.

```bash
# vertekum schema lint [module] [--json] [--cwd <dir>]
vertekum schema lint                        # every module under ./schemas
vertekum schema lint schemas/color.dfn      # one module — fragment or rooted
```

| Argument / flag | What it does                                                                 |
| --------------- | ----------------------------------------------------------------------------- |
| `[module]`      | A `.dfn` file, relative to the working directory. Default: every module under `./schemas`, recursively — **fragments included**. |
| `--json`        | Machine-readable result.                                                       |
| `--cwd <dir>`   | Project discovery starts here.                                                 |

Exit `0` when the grammar is sound, `1` with findings — one per line, positioned:

```
2 problem(s) in the .dfn modules:
  schemas/emphasis.dfn:1:21 unknown production '<missing>'
  schemas/scale.dfn:1:14 '*' marks a set open and sits inside the reference or group it opens — <name*> or [a | b *]
```

## What lint checks that a build does not

A build expands from `root`, so its validation reaches exactly what a root reaches.
Lint's contract is the source:

- **Fragments** — a module with no `root` never builds, but lint evaluates its
  productions, so a broken denotation is caught in the file that declares it, not
  months later in the first module that imports it.
- **Unused productions** — a rooted module's production that nothing references yet is
  still checked.
- **Everything a build would refuse** — unknown or ambiguous references, pick/omit
  members that don't exist, scale collisions, `*` on a non-name set, reference cycles —
  reported the same way, at the same positions.

Findings **collect**: one broken production does not hide the next, so a module with
three mistakes is one lint run, not three.

## Sound vs. current

`lint` and [`build --check`](./build.md#--check-the-staleness-gate) answer different
questions:

| Verb            | Question                    | Covers                                    |
| --------------- | --------------------------- | ------------------------------------------ |
| `schema lint`   | Is the grammar sound?       | Every `.dfn`, fragments and all; no artifacts touched. |
| `schema build --check` | Are the artifacts current? | Rooted modules' built `.json` vs. disk.  |

CI wants both — lint fails a broken fragment the staleness gate cannot see, and the
staleness gate fails a sound grammar whose rebuild was forgotten.

## Programmatic use

`lintModule(path)` (from `@vertekum/schema-builder/api`) returns the findings as
`{ file, line, column, message }` records — an empty array means sound.
