# The module

A `.dfn` file is a **module**: a line-oriented text file declaring a vocabulary. This
page is the module's structure — statements, pragmas, and imports; the expression forms
that appear to the right of `=` are [expressions](./expressions.md).

```dfn
# color.dfn — the colour vocabulary this project enforces
title "Colour vocabulary"

use "./denotations/emphasis.dfn"

role = neutral | brand | success

root = color.[text | icon].<role>.<@emphasis>
```

## Lexical rules

- **A statement ends at the first newline at bracket depth 0.** A `[` whose content
  continues past its line opens a **block**, closed by its `]` — newlines inside are
  insignificant, nesting is unbounded, and an unclosed `[` reports its opening
  position. A line that starts with whitespace also continues the statement above it
  (the unbracketed-wrap fallback).

  ```dfn
  root = color.[
    <property>.<role>?.<emphasis>?
    | <code>
  ]
  ```

- **`#` starts a comment**, running to the end of the line.
- **Identifiers** are letters, digits, and hyphens (`color-role`), and may start with
  digits **when they contain a letter** (`2xs`, `4k-display`). A term that is purely
  numeric keeps its numeric meaning: a bare number (`950`) or a
  [scale expression](./scales.md) (`100-300/50`) — which is why hyphens inside names
  never collide with range syntax. A parenthesized formula with word affixes
  (`(2-4)xs`) is one term; parentheses appear nowhere else in the grammar.
- **Strings** (pragma and `use` arguments) are double-quoted.

## Statements

| Statement                | What it is                                                       |
| ------------------------ | ----------------------------------------------------------------- |
| [`name = expression`](#productions) | A **public** production — a named export: importable (`<@mod/name>`) and emitted as a `$defs` pattern. |
| [`:name = expression`](#productions) | A **private** production — inlined at use, invisible to importers. |
| [`root = expression`](#root)        | The default export: the definitive syntagma.           |
| [`use "…" [as name]`](#use)         | Import another module.                                 |
| [`id` / `title` / `description` / `scope` / `sealed` `"…"`](#pragmas) | Metadata and nature pragmas. |

### Productions

`name = expression` binds a name to an expression — a denotation (a set of names), a
branch, or a whole subtree. A production is referenced as `<name>` locally and, when
public, as `<@module/name>` by importers. Like JavaScript's exports: a plain
declaration is a named export — it emits into the artifact's `$defs` as a PATTERN —
while `:name = …` declares it **private**: usable locally, inlined wherever it
appears, refused to importers, absent from the artifact. A production may not expand
through itself — a reference cycle is a build error.

### `root`

`root = expression` is the reserved production the build materializes: the module's
whole name tree grows from it. One per module.

A module **without** a root is a **fragment** — a library of productions that exists to
be `use`d by other modules. The build sweep skips fragments (with a notice); naming one
explicitly as the build argument is an error, so a typo'd `root` cannot pass silently.
See [modules](./modules.md#fragments).

### `use`

`use "<specifier>"` imports another module; `as <name>` renames the import. Specifier
forms, import accessors, and collision handling are [modules](./modules.md).

### Pragmas

A pragma is an identifier followed by a string, each usable at most once per module:

| Pragma        | Value                        | Meaning                                   |
| ------------- | ---------------------------- | ----------------------------------------- |
| `id`          | any string (usually a URI)   | `$id` (wins over the configured [`schemaId`](./build.md#configuration) derivation) |
| `title`       | any string                   | `title`                                   |
| `description` | any string                   | `description`                             |
| `scope`       | `"document"` \| `"def"` \| `"inline"` | The file's NATURE — how it emits and how consumers reference it. |
| `sealed`      | `"true"` (default) \| `"false"` | Whether the document top is sealed.    |

`scope` — the file's nature:

| Value        | Emitted? | root | Consumers reference                                    |
| ------------ | -------- | ---- | ------------------------------------------------------- |
| `"document"` | own file | **required** | its top-level names (`…#/properties/<name>`)     |
| `"def"`      | own file | optional — also lands as `$defs.root` | the root as the **file itself** (`{ "$ref": "./color.json" }`); productions as `…#/$defs/<name>` |
| `"inline"`   | never    | optional | expansion only — `:private` at file level          |

Absent, the nature defaults from the root: root → `document`, rootless → `def`.

`sealed` defaults by nature: a `document` seals (`"true"` — it validates alone), a
`def` file does not (`"false"` — pattern-natured, so consumers can whole-file-compose
it beside siblings); either can override. `sealed "false"` on a document lets
per-aspect vocabularies bind over the same token files without rejecting each other's
branches. (The historical `scope "branch"` still parses as an alias, with a lint
deprecation warning.)
The exact effect on the emitted JSON is [emission](./emission.md).

## Editor support

The package ships a TextMate grammar and language configuration for `.dfn` under
`grammar/` — editors and tooling that consume TextMate grammars can pick them up from
there.
