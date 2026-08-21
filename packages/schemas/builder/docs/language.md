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

- **Statements are lines.** One statement per line; a line that starts with whitespace
  **continues** the statement above it, so a long expression wraps without any
  continuation character:

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
  never collide with range syntax.
- **Strings** (pragma and `use` arguments) are double-quoted.

## Statements

| Statement                | What it is                                                       |
| ------------------------ | ----------------------------------------------------------------- |
| [`name = expression`](#productions) | A **production**: a named fragment of the vocabulary.  |
| [`root = expression`](#root)        | The reserved production a build materializes.          |
| [`use "…" [as name]`](#use)         | Import another module.                                 |
| [`id` / `title` / `description` / `scope` `"…"`](#pragmas) | Document metadata pragmas.      |

### Productions

`name = expression` binds a name to an expression — a denotation (a set of names), a
branch, or a whole subtree. Productions exist to be referenced (`<name>`) from other
productions or the root; an unreferenced production builds nothing on its own. A
production may not expand through itself — a reference cycle is a build error.

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

| Pragma        | Value                        | Lands in the built schema as              |
| ------------- | ---------------------------- | ----------------------------------------- |
| `id`          | any string (usually a URI)   | `$id`                                     |
| `title`       | any string                   | `title`                                   |
| `description` | any string                   | `description`                             |
| `scope`       | `"document"` \| `"branch"`   | whether the document root is sealed       |

`scope` is the one with semantics, and exactly two values:

| Value        | Meaning                                                                                       |
| ------------ | ---------------------------------------------------------------------------------------------- |
| `"document"` | Default. The schema **seals** the document root: nothing beyond the granted names may exist.   |
| `"branch"`   | The schema governs only the top-level branches it names — the root stays **unsealed**, so sibling vocabularies (a colour module, a spacing module) can each bind over the same token files without rejecting each other's branches. |

A single whole-vocabulary schema wants the default; per-aspect schemas that co-validate
one collection want `"branch"`. The exact effect on the emitted JSON is
[emission](./emission.md#scope).

## Editor support

The package ships a TextMate grammar and language configuration for `.dfn` under
`grammar/` — editors and tooling that consume TextMate grammars can pick them up from
there.
