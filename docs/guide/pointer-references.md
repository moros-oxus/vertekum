# Pointer references

DTCG defines two ways for a token to reference another. Vertekum supports both.

A **curly alias** names a token by its dotted path and resolves against the
composed view — the merged result of the resolver's sets and modifiers:

```json
{ "accent": { "$value": "{color.brand.primary}" } }
```

A **JSON Pointer reference** (RFC 6901) addresses a *location in the document*.
`#` means "this document", and per the resolver module that is the **composed
document** — references resolve after the resolution order has been flattened
into a single tokens structure. A pointer written in `text.json` can therefore
reach a token contributed by `core.json`, and what it finds can depend on the
active modifier contexts, exactly like a curly alias. The two notations differ
in *how* they address (location segments vs. token names) and *what* they can
reach (pointers can extract fragments of values), not in scope.

Pointer syntax itself stays within the document: token files only admit `#/…`
forms (the format schema's rule). File-to-file `$ref`s — `{"$ref": "core.json"}`
— belong to resolver documents, where they wire sets together.

## The three pointer forms

**Token position** — `$ref` instead of `$value`, pointing at another token:

```json
{ "alias": { "$ref": "#/color/brand/primary" } }
```

The token adopts the value the target denotes. Its own `$type` (or the group's
inherited one) still applies — the target's type is not copied.

**Property access** — the pointer may continue past a token into its value,
extracting a fragment:

```json
{ "primaryHue": { "$ref": "#/color/brand/primary/$value/components/2", "$type": "number" } }
```

Segments before `$value` are token names; everything after addresses into the
value itself. `$root` is a token name and works as an ordinary segment
(`#/color/text/$root`).

**Value position** — a `{"$ref"}` object standing where a value would, including
inside composite values:

```json
{
  "border": {
    "$type": "border",
    "$value": {
      "width": { "value": 1, "unit": "px" },
      "style": "solid",
      "color": { "$ref": "#/color/brand/primary/$value" }
    }
  }
}
```

## How Vertekum treats them

Pointers resolve against the composed document: the un-composed model (what the
UI and CLI verbs show) resolves them against the whole collection merged, and
every export or check under a resolver re-resolves them per selection — the
same rules as curly aliases. The file keeps the pointer exactly as authored,
and untouched tokens round-trip byte-identically.

Exports emit pointer results as **literals** — a fragment like a colour channel
has no `var()` counterpart, so no reference chain is emitted for pointers
(curly aliases keep emitting `var()`).

`token rename` rewrites pointers along with curly aliases: renaming
`color.brand.primary` updates `#/color/brand/primary/$value/components/2` to
the new path, fragment tail intact, with RFC 6901 escaping applied.

`vertekum check` reports pointer problems as errors:

- `token/dangling-pointer` — the pointer's target does not exist in the
  composed document (including a pointer landing on a group, which is not a
  value). Checked per composition: a target contributed only by one modifier
  context dangles under the others.
- `token/cyclic-pointer` — a chain of `$ref` tokens that revisits itself.
- `token/type-mismatch` — a declared `$type` conflicting with what the
  reference resolves to: for whole-token references (curly aliases and
  token-node pointers), the target's resolved type; for property-level
  fragments, the materialized value judged by the published schema for the
  declared type. Undeclared types inherit (§5.2.2) and are never reported.

Editing a pointer token's value through the CLI or UI replaces the reference
with the new literal (`$value` and `$ref` are mutually exclusive). Vertekum
reads pointers wherever they exist but authors curly aliases: `token add` and
`token set` accept curly notation, not pointers.

## Out of scope, for now

- Group `$extends` (DTCG §6.4) is not yet supported.
- Pointers cannot be created through verbs or editors — they are honoured on
  read.
