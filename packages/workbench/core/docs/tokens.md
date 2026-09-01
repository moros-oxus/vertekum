# Tokens

Vertekum stores design tokens as DTCG files — the Design Tokens Community Group format,
2025.10. The file **is** the model: the system holds the parsed trees untransformed, and
everything it does not model (vendor extensions, unrecognized keys) survives a round-trip
byte-for-byte in structure.

## The collection

The collection directory holds one JSON file per **set** and zero or more resolver
documents (`*.resolver.json`, covered in [resolvers](./resolvers.md)). Sets are the
unit of composition: a resolver combines them into themes.

Files may live in subdirectories — **directories are purely organizational**, no
semantics attach to structure. A set's name is its collection-relative path minus
`.json`: `core.json` is the set `core`, `brands/brand-a.json` is the set
`brands/brand-a` (that name is what resolver sources reference and what `--set`
takes). Hidden entries (dot-files and dot-directories) are never part of a
collection.

A token's identity is `(set, path)` — nothing synthetic is stored in the files.

## Groups and types

DTCG lets a group declare `$type` on behalf of every descendant that does not declare its
own, and that is the more common authoring style:

```json
{
  "color": {
    "$type": "color",
    "brand": { "$value": { "colorSpace": "oklch", "components": [0.7, 0.15, 250], "alpha": 1, "hex": "#7aa2f7" } },
    "text":  { "$value": "{color.brand}" }
  }
}
```

The nearest ancestor's type carries down; a token's own `$type` always wins.

### `$root` — a group's own value

DTCG forbids a node that is both a token and a group, but real design systems are full of
names that are simultaneously a value and an ancestor — `color.text` alongside
`color.text.subtle`. The 2025.10 spec reserves the token name `$root` for exactly this:

```json
{
  "color": {
    "text": {
      "$root":  { "$value": "{color.gray.900}" },
      "subtle": { "$value": "{color.gray.600}" }
    }
  }
}
```

`$root` is part of the reference path (`{color.text.$root}` resolves; `{color.text}` does
not) but it is an encoding detail, not a name: on export the token is emitted under the
group's own path — `color.text`, which is what the design system called it all along.

## Values

Values are stored in the spec's **object notation** — a colour is a `colorSpace` +
`components` + `alpha` + `hex` object, a dimension is `{ "value": 4, "unit": "px" }`, a
duration `{ "value": 200, "unit": "ms" }`. Author-ergonomic short forms (`#7aa2f7`,
`4px`, `200ms`) are accepted at every input edge and converted on write; the
[`defaultColorSpace` config field](./config.md#defaultcolorspace) decides which space
colours are stored in.

The codecs are exposed for direct use as `dtcg.values`:

- `parse(type, raw, options?)` — author input → spec object, keyed by the token's
  effective type. Only `color`, `dimension`, and `duration` transform; every other type is
  already spec-true as written.
- `render(value)` — spec object → CSS string (`oklch(0.7 0.15 250)`, `4px`), synchronous
  and shape-dispatched.
- `renderHex(value)` — hex from components, always computed, never trusted from storage
  (hex is sRGB).
- `convertColor(value, targetSpace)` — move a stored colour to another space; the
  export-side counterpart of `parse` for targets that deliver in a different space than
  the author stores.
- `COLOR_SPACES` — the spec's colour-space names, read from the bundled format schema.

## References

Two reference forms, both from the spec:

**Alias values** — a string wrapping a dotted path in braces:

```json
{ "$value": "{color.brand}" }
```

Aliases resolve across sets and groups within the flattened document.

**JSON Pointers** — RFC 6901, in URI-fragment form, addressing the document structurally:

```json
{ "$ref": "#/color/brand" }
```

A pointer appears in **token position** (`$ref` instead of `$value` — the node adopts the
target's value) or in **value position** (a `{ "$ref": "…" }` object inside a composite
value). `#` addresses the flattened document, so under a composition a pointer's target
depends on which sets the active selection merged.

A reference whose target's `$type` disagrees with the referencing token's effective type
is a validation error — a reference borrows a value, not a type.

## `$extensions`

The spec's vendor-extension bucket. Keys under `org.vertekum.*` are reserved for the
system's own data; every other vendor's keys are preserved verbatim through parse,
edit, and write. Unknown `org.vertekum.*` keys are ignored on parse and preserved on
write, so files from a newer version remain safe to edit in an older one.

### Custom types, and extension-held data

Two different needs, two mechanisms:

- **Custom and compound types** — a `textCase` token, a typography value with a
  `textDecoration` member — are declared by
  [extending the DTCG schema](./schemas.md#extending-the-dtcg-schema); tokens carry
  them directly in `$type`/`$value`. Such files are the project's declared dialect:
  valid against its effective schema, not against the unextended spec.
- **Generative data** — a payload a value (or set of values) derives from — lives in
  `$extensions` on a carrier node, materialized into ordinary tokens by an
  extension's codec; see [extension-held token data](./extension-data.md).

## Programmatic access

`parseCollection(files)` turns a file record into a flat `Token[]`; `serializeSets`
writes one back. The `dtcg.tokens` facade holds the read-side operations: `isReference`,
`referenceToPath`, `indexByPath`, `resolveValue` (follow aliases to the effective value),
`flatten` (opt-in dereference of a whole list), `exportPath` (`$root` removal), and the
pointer helpers. See [the core API](./api.md).
