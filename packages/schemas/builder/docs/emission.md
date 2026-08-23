# What a build emits

A built schema is ordinary JSON Schema (2020-12). One content rule, every file:
**public productions emit as `$defs` patterns; the root emits as the document's
`properties` — the definitive syntagma; private productions inline.** A pattern never
seals — sealing belongs to the positions that apply patterns.

## Patterns and positions

A **pattern** (a `$def` body) is open at its top:

```json
{ "type": "object", "properties": { "…members…": {} }, "patternProperties": { "^\\$": true } }
```

A **position** that applies patterns composes them under its own seal:

```json
{
  "allOf": [{ "$ref": "#/$defs/named-even" }, { "$ref": "#/$defs/named-odd" }],
  "type": "object",
  "properties": { "…locals and expansions…": {} },
  "patternProperties": { "^\\$": true },
  "unevaluatedProperties": false
}
```

- A reference becomes a `$ref` exactly when it **ends its path**; a tail forces
  expansion at that spot (a `$ref` cannot be parameterized). Modified (pick/omit) and
  open references always expand — a modified set is a new set.
- A merge that grew a pattern's member drops the `$ref` back to expansion — emission
  deep-checks every pattern before referencing it.
- `patternProperties: { "^\\$": true }` lets DTCG's structural members pass at every
  level; `unevaluatedProperties: false` is the closure, and 2020-12's `unevaluated`
  sees through `allOf`/`$ref`, which is what makes sealed composition sound.
- The empty sealed leaf emits once as **`$defs.terminal`** and is referenced from
  every leaf.

## The file's nature

Per the [`scope` pragma](./language.md#pragmas): a `document` file emits its root tree
as sealed properties (per `sealed`, default true). A `def` file emits its `$defs` —
and when it has a root, the root ALSO lands as `$defs.root` while the document body
applies it (`allOf`, unsealed by default — pattern-natured), so the file stands alone
AND serves as a pattern source. Externally, a def module's root is referenced as the
FILE itself. An `inline` file never emits.

## Open positions

A position whose set is [open](./expressions.md#open-sets) (`*`) replaces the closure
with a route for additions:

```json
{
  "type": "object",
  "properties": { "…the listed members…": {} },
  "patternProperties": { "^\\$": true },
  "additionalProperties": { "…the members' shared tail…": {} }
}
```

Additions join the set: they take the same tail every listed member has (which is
well-defined precisely because `*` is restricted to name-only sets).

## Linked emission

By default every artifact is **self-contained** — an embedded module's expansion is
inlined, so a file validates and diffs alone. With `link: true` on the extension
(see [build § configuration](./build.md#configuration)), an unmodified `<@module>`
root embedding with nothing threaded beneath it is emitted as a reference into the
child module's own artifact instead — a document child by top-level name, a def
child's root as the whole file (or, when the child is `sealed "true"`, as its unsealed
`…#/$defs/root`), any public production by pattern:

```json
"color": { "$ref": "./primitives/color.json#/properties/color" }
{ "allOf": [{ "$ref": "./primitives/color.json" }], "…seal…": "" }
"scale": { "allOf": [{ "$ref": "./primitives/color.json#/$defs/scale" }], "…seal…": "" }
```

Property keys stay local — the parent's seal is untouched. What still inlines under
`link: true`, for correctness: picked/omitted refs (a modified set is a new set),
open refs, refs with a non-terminal tail (the tail threads through every leaf),
`scope "inline"` children, and modules this project does not build (package imports).
Binding validation resolves the linked graph offline via the relative paths;
standalone validators need the referenced files registered.

## Linked emission

By default every artifact is **self-contained** — an embedded module's expansion is
inlined, so a file validates and diffs alone. With `link: true` on the extension
(see [build § configuration](./build.md#configuration)), an unmodified `<@module>`
root embedding with nothing threaded beneath it is emitted as a reference into the
child module's own artifact instead:

```json
"color": { "$ref": "./primitives/color.json#/properties/color" }
```

The property key stays local — the parent's seal is untouched — and the referenced
subtree is semantically identical to the inline copy. What still inlines under
`link: true`, for correctness: picked/omitted refs (a modified set is a new set),
open refs, refs with a non-terminal tail (the tail threads through every leaf),
production refs (fragments and productions have no artifact), and modules this
project does not build (package imports). Binding validation resolves the linked
pair offline; standalone validators need the referenced files registered.

## Document keys

| Key                     | From                                                             |
| ----------------------- | ----------------------------------------------------------------- |
| `$schema`               | always `https://json-schema.org/draft/2020-12/schema`             |
| `$id`                   | the [`id` pragma](./language.md#pragmas), else derived from the configured [`schemaId`](./build.md#configuration) |
| `$comment`              | the provenance stamp — the [ownership contract](./build.md#ownership-the-stamp) |
| `title`, `description`  | their pragmas, when declared                                      |
| `$defs`                 | `terminal`, the public patterns (declaration order), then a def-scope root |
| the document body       | `allOf?`, `type`, `properties`, `patternProperties`, and the seal |

## Sealing

The [`sealed` pragma](./language.md#pragmas) decides the **document top** only:
`"true"` (default) carries `unevaluatedProperties: false` — nothing beyond the granted
top-level names may exist in a bound file; `"false"` omits it, so several per-aspect
schemas can bind over one collection. Every level *below* the top stays sealed either
way — and patterns are open at their tops by nature, sealed by the positions that
apply them.

## A complete example

`schemas/color.dfn`:

```dfn
emphasis = subtle | bold

root = color.[text | icon].<emphasis>
```

builds to `schemas/color.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$comment": "built by @vertekum/schema-builder from schemas/color.dfn — do not hand-edit; remove this comment to take ownership",
  "$defs": {
    "terminal": {
      "type": "object",
      "properties": {},
      "patternProperties": { "^\\$": true },
      "unevaluatedProperties": false
    },
    "emphasis": {
      "type": "object",
      "properties": {
        "subtle": { "$ref": "#/$defs/terminal" },
        "bold": { "$ref": "#/$defs/terminal" }
      },
      "patternProperties": { "^\\$": true }
    }
  },
  "type": "object",
  "properties": {
    "color": {
      "type": "object",
      "properties": {
        "text": {
          "allOf": [{ "$ref": "#/$defs/emphasis" }],
          "type": "object",
          "patternProperties": { "^\\$": true },
          "unevaluatedProperties": false
        },
        "icon": {
          "allOf": [{ "$ref": "#/$defs/emphasis" }],
          "type": "object",
          "patternProperties": { "^\\$": true },
          "unevaluatedProperties": false
        }
      },
      "patternProperties": { "^\\$": true },
      "unevaluatedProperties": false
    }
  },
  "patternProperties": { "^\\$": true },
  "unevaluatedProperties": false
}
```

`emphasis` is a public production, so it emits as an open pattern in `$defs`; the
positions `color.text` and `color.icon` apply it under their own seals; every empty
leaf is one `$ref` to `$defs.terminal`. A token file bound to this schema may hold
`color.text.subtle` with any `$`-members along the way — and nothing named outside
the grant.
