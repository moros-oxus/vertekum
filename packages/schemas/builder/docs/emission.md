# What a build emits

A built schema is ordinary JSON Schema (2020-12), in the **names-and-order** shape
hand-written vocabulary schemas use — so a generated file and a hand-written one are
interchangeable, and taking ownership of a generated file (removing the stamp) leaves
you with idiomatic schema, not machine soup.

## The position shape

Every position in the name tree becomes:

```json
{
  "type": "object",
  "properties": { "…declared children…": {} },
  "patternProperties": { "^\\$": true },
  "unevaluatedProperties": false
}
```

- `properties` holds the granted names, one position schema each.
- `patternProperties: { "^\\$": true }` lets DTCG's structural members (`$value`,
  `$type`, `$description`, …) pass at every level — the vocabulary governs **names**,
  not the token format (the format schemas do that separately).
- `unevaluatedProperties: false` is the closure: a name outside the grant is a
  violation, which is the entire point of a vocabulary schema.

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

## Denotations become `$defs`

A terminal denotation referenced from **two or more** positions is emitted once under
`$defs` and `$ref`'d — matching how a hand author avoids repeating themselves. A
single-use denotation is inlined. A [picked or omitted](./expressions.md#pick-and-omit)
set never shares the source's `$def`: a modified set is a different set.

## Document keys

| Key                     | From                                                             |
| ----------------------- | ----------------------------------------------------------------- |
| `$schema`               | always `https://json-schema.org/draft/2020-12/schema`             |
| `$id`                   | the [`id` pragma](./language.md#pragmas), when declared           |
| `$comment`              | the provenance stamp — the [ownership contract](./build.md#ownership-the-stamp) |
| `title`, `description`  | their pragmas, when declared                                      |
| `$defs`                 | shared denotations, when any                                      |
| the root position       | `type`, `properties`, `patternProperties`, and the seal           |

## Scope

The [`scope` pragma](./language.md#pragmas) decides the **root** seal only:

- `"document"` (default): the root carries `unevaluatedProperties: false` — nothing
  beyond the granted top-level names may exist in a bound file.
- `"branch"`: the root omits it — the schema governs its own branches and ignores
  siblings, so several per-aspect schemas can bind over one collection. Every level
  *below* the root stays sealed either way.

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
    "emphasis": {
      "type": "object",
      "properties": {
        "subtle": {
          "type": "object",
          "properties": {},
          "patternProperties": { "^\\$": true },
          "unevaluatedProperties": false
        },
        "bold": {
          "type": "object",
          "properties": {},
          "patternProperties": { "^\\$": true },
          "unevaluatedProperties": false
        }
      },
      "patternProperties": { "^\\$": true },
      "unevaluatedProperties": false
    }
  },
  "type": "object",
  "properties": {
    "color": {
      "type": "object",
      "properties": {
        "text": { "$ref": "#/$defs/emphasis" },
        "icon": { "$ref": "#/$defs/emphasis" }
      },
      "patternProperties": { "^\\$": true },
      "unevaluatedProperties": false
    }
  },
  "patternProperties": { "^\\$": true },
  "unevaluatedProperties": false
}
```

`<emphasis>` sits at two terminal positions (`color.text`, `color.icon`), so it became
a shared `$def`. A token file bound to this schema may hold `color.text.subtle` with
any `$`-members along the way — and nothing named outside the grant.
