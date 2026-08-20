# @vertekum/schema-builder

Declare a token vocabulary as grammar; build it into ordinary JSON Schema files.

A vocabulary schema governs **names and order** — which token names may exist, in what
order, and where the order ends. Writing that shape by hand means dozens of lines of JSON
Schema per branch. This extension adds a definition language (`.dfn` files) that states the
same thing in one expression, and a build step that materializes the JSON Schema files your
`schemas` config binds. Core, `check`, and every consumer keep seeing plain schema files —
the grammar is authoring source, never a runtime notation.

## Get started

1. Add the extension to your config:

```ts
import { defineConfig } from '@vertekum/core';
import { schemaBuilderExtension } from '@vertekum/schema-builder';

export default defineConfig({
  collection: './tokens',
  extensions: [schemaBuilderExtension],
  schemas: [{ from: './schemas', domain: 'vocabulary', use: { 'house.json': '*.json' } }],
});
```

2. Declare the vocabulary — `schemas/house.dfn`:

```dfn
emphasis = subtle | bold

root = color.text.[neutral | brand | success].<emphasis>
```

3. Build it, then check as usual:

```bash
npx vertekum schema build          # writes schemas/house.json beside the module
npx vertekum check                 # the built schema now governs your token names
```

`schema build` accepts a single module argument, defaults to every `.dfn` under
`./schemas`, and supports `--dry-run` (list without writing), `--json`, and `--check`
(verify built files are current; exit 1 when stale — the CI guard).

## The definition language

A module is line-oriented: `#` comments, pragmas, `use` imports, and productions. An
indented line continues the statement above it.

### Statements

| statement | meaning |
| --- | --- |
| `name = expression` | a **production**: a named fragment (a denotation, a branch, a whole subtree) |
| `root = expression` | the reserved production `build` materializes; one per module |
| `use "./other.dfn"` | import a module (relative path or package specifier) |
| `id "…"` `title "…"` `description "…"` | pragmas: the built schema's `$id`, `title`, `description` |
| `scope "branch"` | the schema governs only its named top-level branches — the document root stays unsealed so sibling vocabularies can bind over the same files (default: `"document"`, which seals it) |

### Expressions

| syntax | meaning |
| --- | --- |
| `a.b.c` | nesting — one name-tree level per step |
| `a \| b` | alternation — the set of permitted names |
| `[ … ]` | grouping; groups may hold full sub-paths (branches) |
| `<name>` | reference a local production |
| `<@name>` | reference an imported production; an imported module's *root* goes by its basename |
| `<name [a, b]>` | **pick** — only the listed members of the set |
| `<name ![a, b]>` | **omit** — the set minus the listed members |
| `<name*>` / `[a \| b *]` | **open set** — additions beyond the listed names are permitted, and every member (listed or added) takes the same tail |
| `step?` | **optional slot** — the step may be skipped: `<role>.<emphasis>?.<state>?` grants `role`, `role.<emphasis>`, `role.<state>`, and the full path |
| `100-900/100` | a numeric range with step, inclusive both ends, enumerated at build |

Pick and omit validate every listed name against the set's members — a typo is a build
error, and a modified set is a new set. Naming one derives a narrowed denotation:

```dfn
use "./colors.dfn"

limited-accents = <@accent-color [red, blue]>
```

### Style: the root reads as the syntagm

State the high-level shape in the root and let unused slots collapse; give forks their own
named productions instead of nesting:

```dfn
property = background | text | icon | border
role = brand | danger | neutral | success | warning
emphasis = subtle | bold
state = hovered | pressed

root = color.[
    <property>.<role>?.<emphasis>?.<state>?
  | <code>
  ]

code = text.code.[comments | keywords | strings]
```

## Built artifacts and ownership

A built file lands beside its module (`house.dfn` → `house.json`) and carries a `$comment`
stamp naming its source. The stamp is the ownership contract: `schema build` regenerates
stamped files and **never overwrites a file whose stamp was removed** — hand-edit the JSON
and delete the stamp to take ownership, and the builder leaves it alone from then on.

## Ejecting grammar

`vertekum schema eject` copies any resolvable file verbatim — including `.dfn` modules
from packages that ship them:

```bash
npx vertekum schema eject @vertekum/schema-atlassian/color.dfn ./schemas/color.dfn
npx vertekum schema build
```

Ejecting the grammar (rather than the built JSON) means your edits stay one-line grammar
edits with a rebuild, instead of surgery on generated schema. Two notes: an ejected module
that `use`s relative imports needs them ejected alongside it; and the config hint `eject`
prints applies to schemas you bind directly — an ejected `.dfn` is not bound, its *built*
`.json` is.
