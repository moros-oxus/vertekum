# `vertekum schema fmt`

Canonical formatting for the `.dfn` sources. One style, mechanically applied — the
choices that stay yours are *where* statements break; everything inside that choice is
the formatter's.

```bash
# vertekum schema fmt [module] [--check] [--dry-run] [--json] [--cwd <dir>]
vertekum schema fmt                       # every module under ./schemas
vertekum schema fmt schemas/color.dfn     # one module
vertekum schema fmt --check               # CI: verify formatting, write nothing
```

| Argument / flag | What it does                                                                 |
| --------------- | ----------------------------------------------------------------------------- |
| `[module]`      | A `.dfn` file, relative to the working directory. Default: every module under `./schemas`, recursively — fragments included. |
| `--check`       | Verify formatting; write nothing. Unformatted files are an error (exit `1`).   |
| `--dry-run`     | Report what would be rewritten without writing.                                |
| `--json`        | Machine-readable result.                                                       |
| `--cwd <dir>`   | Project discovery starts here.                                                 |

A module whose grammar cannot even be lexed is **skipped with a notice** — broken
grammar is [`schema lint`](./lint.md)'s report, and fmt never rewrites what it cannot
read.

## Blocks: JS-literal formatting, your break choices

A `[` with content on its line is **inline**; a `[` followed by a newline is a
**block** — exactly a JavaScript array literal, and exactly what the grammar means: a
statement ends at the first newline at bracket depth 0, so a block carries its
statement to the matching `]`. The formatter never changes which you chose. What it
normalizes, recursively at any depth:

- each block level indents **one unit**;
- the closing `]` dedents to its opener's line;
- a leading `|` sits at its level's indent;
- inline groups ride inside block levels without adding one.

```dfn
root = color.[
  <property>.<role>?.<emphasis>?
  | border.[bold | code | focused]
  | interaction.[
    hovered
    | pressed
  ]
]
```

## The indent unit resolves from what the repo uses

1. **`format.indent`** in `vertekum.config.ts` — the same field JSON output honors.
2. **`.editorconfig`** — standard walk-up and section cascade for the file
   (`indent_style` / `indent_size`; `[*.dfn]` over `[*]`; `root = true` stops the walk).
3. Default: two spaces.

Everything below the indent unit — bracket hugging, operator spacing, comma style — is
**canonical, deliberately without knobs**: `.dfn` files are published, ejected, and
diffed across repos, and one style is what keeps those diffs meaningful.

## Canonical spacing

| Around                | Rule                                        | Example                  |
| --------------------- | ------------------------------------------- | ------------------------ |
| `=`, `\|`             | one space each side                         | `a = b \| c`             |
| `.`                   | tight                                       | `color.text`             |
| `?`                   | tight to its step                           | `<role>?`                |
| `*`                   | tight in a reference; spaced before `]`     | `<x*>`, `[a \| b *]`     |
| pick/omit             | space before `[`/`![`; `, ` between members | `<scale ![0, 1000]>`     |
| group after a dot     | tight                                       | `color.[text \| icon]`   |
| affixed scales        | tight throughout                            | `(2-4)xs`                |
| comments              | full-line at its level; trailing two spaces off the code | `100  # loud` |

Plus hygiene: trailing whitespace stripped, blank-line runs collapse to one, exactly
one trailing newline.
