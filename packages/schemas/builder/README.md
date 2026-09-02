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
  extensions: [schemaBuilderExtension],
  // the BUILT schema (step 3) validating a token set from the collection
  schemas: [{ from: './schemas', use: { 'color-schema.json': 'core-tokens.json' } }],
});
```

2. Declare the vocabulary — `schemas/color-schema.dfn`:

```dfn
emphasis = subtle | bold

root = color.text.[neutral | brand | success].<emphasis>
```

3. Build it, then check as usual:

```bash
npx vertekum schema build          # writes schemas/color-schema.json beside the module
npx vertekum check                 # the built schema now governs your token names
```

The grammar reads the way a design system talks: nesting is `.`, choice is `|`,
denotations are named productions referenced as `<emphasis>`, scales are enumerated
expressions — plain (`100-900/100`, `16-64*1.25~4`) or affixed (`(2-4)xs` → `2xs 3xs
4xs`) — and `?` marks a slot as optional. One
expression grants a whole syntagm:

```dfn
root = color.<property>.<role>?.<emphasis>?.<state>?
```

## Documentation

- [The module](./docs/language.md) — statements, pragmas (`id`, `title`, `description`,
  `scope`), comments and continuation, `root` and fragments.
- [Expressions](./docs/expressions.md) — nesting, alternation, groups, references,
  pick/omit, open sets, optional slots; the style that keeps a root readable.
- [Scales](./docs/scales.md) — additive and geometric ranges, zero-padding,
  quantization, the locked semantics.
- [Modules and composition](./docs/modules.md) — `use` and aliasing, fragments,
  aggregate roots, nested directories, shipping and ejecting grammar.
- [`schema build`](./docs/build.md) — the command, the sweep, the ownership stamp, the
  `--check` CI gate, programmatic use.
- [`schema lint`](./docs/lint.md) — validate the `.dfn` sources themselves: fragments
- [`schema mock`](./docs/mock.md) — render the granted matrix: name listings, sample token files, deliberate breakage.
  included, every production, findings collected with positions; `--fix` repairs the
  mechanical ones.
- [`schema fmt`](./docs/format.md) — canonical formatting: JS-literal blocks, indent
  from `format.indent`/.editorconfig, `--check` for CI.
- [What a build emits](./docs/emission.md) — the names-and-order schema shape, open
  positions, `$defs`, scope; a complete dfn→JSON example.

## Ownership in one paragraph

A built file lands beside its module (`color.dfn` → `color.json`) and carries a
`$comment` stamp naming its source. `schema build` regenerates stamped files and
**never overwrites a file whose stamp was removed** — deleting the stamp line is how
you take ownership of the JSON and part ways with the grammar. Until then, the `.dfn`
is the source of truth and `--check` keeps CI honest about rebuilds.

## License

Apache-2.0
