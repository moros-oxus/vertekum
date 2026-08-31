# Schema validation

Vertekum validates the collection's raw files against JSON Schemas **before parsing** —
anything malformed is reported at the file, where the evidence still exists, instead of
silently coerced into the model. Two kinds of schema apply:

- **Format schemas** — is this well-formed DTCG? Bundled with the system; always on.
- **Vocabulary schemas** — does this collection use only the names its design system
  grants? Configured per project via the `schemas` [config field](./config.md#schemas).

Being well-formed and using permitted names are different questions, and a diagnostic
tells the author which one they got wrong: the two kinds **layer** — every schema whose
binding fits a file runs against it; there is no first-match-wins.

`vertekum describe` lists the bindings actually in force — including the resolved path of
each schema file, so the permitted vocabulary can be read directly.

## Example

Because a `use` entry maps a file name to a file name, the examples below suffix each
side: `*-schema.json` is a schema file (found under `from`), `*-tokens.json` is a token
set in the collection (named by `match`). The suffixes are for clarity — nothing requires
them.

```ts
schemas: [
  {
    // the base: a package specifier, or a directory relative to the config file
    from: './schemas',

    // one entry per schema file:  <schema file in `from`>: <what it applies to>
    use: {
      // shorthand — the string is a `match` glob over collection file names
      'color-schema.json': 'core-tokens.json',

      // full form
      'space-schema.json': {
        match: '*-tokens.json',   // every token set
        severity: 'warning',      // advisory: reported, never fails `check`
      },
    },

    // group-level defaults; a `use` entry's own value wins
    domain: 'house',
  },
]
```

Grouping exists because a design system is adopted by aspect — taking colour and spacing
from one package while leaving its typography alone is the normal case, so the part that
repeats (the base) is stated once and the part that differs (which schemas, applied
where) is the map.

## Fields

A `schemas` entry (a **group**):

| Field                                       | What it does                                                          |
| ------------------------------------------- | --------------------------------------------------------------------- |
| [`from`](#from)                             | The base the `use` keys resolve against. Required.                     |
| [`use`](#use)                               | Schema file → what it applies to, one entry per schema. Required.      |
| [`target`, `severity`, `domain`](#group-defaults) | Group-level defaults for every `use` entry.                      |

### `from`

A string, in one of two forms — one shape, so a local schema is configured exactly like a
packaged one (which is also what the eject flow produces):

| Form                | Example                      | Resolution                                                                |
| ------------------- | ---------------------------- | ------------------------------------------------------------------------- |
| Package specifier   | `'@vertekum/schema-atlassian'` | Node's own resolution — the package's `exports` map governs which files are reachable. |
| Relative directory  | `'./schemas'`                | Joined to the key, relative to the config file.                            |

### `use`

A record: each **key** is a schema file within `from` (resolved as `<from>/<key>`), and
each **value** says what that schema applies to. The value is either a string — shorthand
for `{ match }` — or an object:

| Field                   | Values                       | Default     | What it does                                          |
| ----------------------- | ---------------------------- | ----------- | ----------------------------------------------------- |
| [`match`](#match)       | a glob string                | — (required) | Which collection files the schema validates.          |
| [`target`](#target)     | `'tokens'` \| `'resolver'`   | `'tokens'`  | Which kind of collection file it applies to at all.   |
| [`severity`](#severity) | `'error'` \| `'warning'`     | `'error'`   | Whether a violation fails `vertekum check`.           |
| [`domain`](#domain)     | any string                   | `'schema'`  | The prefix of this schema's diagnostic codes.         |
| [`id`](#id)             | a built-in binding id        | —           | Replaces that built-in instead of layering beside it. |

#### `match`

A glob over the collection-relative **file path** (`core.json`,
`brands/rexall.json`). `*` matches any run of characters — directories included —
and the whole path must match. `'core-tokens.json'` binds one set; `'brands/*'`
binds a subdirectory; `'*'` binds every file of the binding's `target` kind.

#### `target`

Which kind of collection file the binding applies to. Not free-form — exactly two values:

| Value        | Applies to                                                     |
| ------------ | -------------------------------------------------------------- |
| `'tokens'`   | Token sets — every collection file **not** ending `.resolver.json`. Default. |
| `'resolver'` | Resolver documents — files ending `.resolver.json`.             |

`target` is checked before `match`: a `match: '*'` binding with `target: 'tokens'` never
touches a resolver file.

#### `severity`

How a violation counts. Exactly two values:

| Value       | Effect                                                                    |
| ----------- | ------------------------------------------------------------------------- |
| `'error'`   | Reported; `vertekum check` exits `1`. Default.                             |
| `'warning'` | Reported; never fails the run — warnings alone exit `0`. For advisory schemas. |

#### `domain`

Any string — not an enum. It becomes the prefix of every diagnostic code this schema
produces: codes are `<domain>/<keyword>`, where the keyword is the JSON Schema keyword
that failed (`house/unevaluatedProperties`, `house/type`, …). The default is `schema`,
which is also what the built-in format bindings use — so give a vocabulary its own domain
(its name is the natural choice) to make the two distinguishable in a report.

#### `id`

Any string, but it only does something when it matches an existing binding's id: the
configured entry then **replaces** that binding rather than layering beside it. The ids
that exist to be replaced are the built-ins:

| id              | Applies to     | Checks                          |
| --------------- | -------------- | ------------------------------- |
| `dtcg-tokens`   | token sets     | the DTCG token format (2025.10) |
| `dtcg-resolver` | resolver files | the DTCG Resolver Module format |

`vertekum describe` lists every active binding with its id. Replacement is how a project
ejects a schema the system ships and binds its own copy back — a moving spec becomes a
file swap:

```ts
schemas: [
  {
    from: './schemas',
    use: {
      'dtcg-tokens-schema.json': { match: '*', id: 'dtcg-tokens' },
    },
  },
]
```

Layering a second copy instead would report the same violation twice, and there would be
no way to loosen a shipped rule.

### Group defaults

`target`, `severity`, and `domain` may also sit at group level, as defaults for every
`use` entry; an entry's own value wins:

```ts
schemas: [
  {
    from: '@acme/schemas',
    domain: 'acme',          // every entry reports as acme/*
    severity: 'warning',     // the whole vocabulary is advisory…
    use: {
      'color-schema.json': '*-tokens.json',
      'space-schema.json': { match: '*-tokens.json', severity: 'error' }, // …except spacing
    },
  },
]
```

## How schema files are resolved

A `use` key is resolved as `<from>/<key>` (see [`from`](#from)). The loaded schema is
ordinary JSON Schema — draft-07, 2019-09, or 2020-12, each validated under the dialect it
declares (absent means 2020-12).

### `$ref` across files

A schema may reference another file — a path (`./base-schema.json`), a package specifier
(`@acme/schemas/color-schema.json`), or either with a JSON-Pointer fragment
(`./base-schema.json#/properties/color`). The loader resolves each reference, loads the
target, and registers it so composition works across files and packages.

Remote references are **never fetched**. A `$ref` to an `https://…` URL is fine when a
loaded file declares that URL as its `$id` (the published DTCG schema references its own
inlined definitions this way); a reference only a network fetch could satisfy is an
error — offline and CI must behave identically. Vendor the schema as a file whose `$id`
is that URL.

## Extending the DTCG schema

Custom and compound types are declared by **extending the effective DTCG schema** —
tokens then carry them directly in `$type`/`$value`. Two pieces make the declaration
small:

**Derived anchors.** Short names for the effective `dtcg-tokens` schema's parts —
`dtcg#tokenType`, `dtcg#token`, `dtcg#typographyValue`, `dtcg#curlyBraceReference`,
`dtcg#tokenValueReference`, each value schema as `dtcg#<type>Value` — usable as `$ref`
targets from any binding's schema (2020-12 documents). Anchors derive from the schema
**in effect**, so an ejected or replaced DTCG binding feeds them.

**Patch documents.** A schema whose top level is only `$extends`, mapping anchors to
deltas, merged into the effective DTCG schema at load:

```json
{
  "$extends": {
    "dtcg#tokenType": { "enum": ["textCase"] },
    "dtcg#token": {
      "allOf": [ { "if": { "properties": { "$type": { "const": "textCase" } } },
                   "then": { "properties": { "$value": {
                     "anyOf": [ { "enum": ["none", "uppercase", "lowercase", "capitalize"] },
                                { "$ref": "dtcg#tokenValueReference" } ] } } } } ]
    }
  }
}
```

Merge semantics are **additive** — objects deep-merge, `enum`/`required` union,
`allOf`/`anyOf`/`oneOf` append, scalars replace. Extending only ever adds; narrowing
is what *layering* already does (every binding must pass). The merge is structural and
happens at load, because the spec's value schemas are closed and composition cannot
open them. An unknown target is `schema/unknown-extend-target`, never a silent no-op.

Extended types are the project's **declared dialect**: valid against its effective
schema — which travels as these small bindable documents — not against the unextended
spec.

## Routes and assembly

Bindings arrive by three routes — the built-ins, config `schemas[]`, and extensions
(the `'schema-bindings'` service) — and are assembled into one set: `id` replacement
resolves **last-wins across every route** (an extension can eject exactly as config
can), patch documents merge in order, and each binding carries an `origin`
(`core` / `config` / `extension`) that `describe` publishes, so which schema is in
effect and who supplied it stays inspectable. An extension may also register ordinary
layered bindings — e.g. validating its own `$extensions` payloads (see
[extension-held token data](./extension-data.md)) under its own [`domain`](#domain).

## Diagnostics

Schema failures come back through `vertekum check` in the same vocabulary as every other
diagnostic: a code, a severity, a file, and a JSON Pointer to the offending node —
`/color/base/$description` names the thing, which is more actionable than a line number.

Violation codes are [`<domain>`](#domain)`/<keyword>`. When a closed schema rejects a
name, the message lists what **is** permitted at that position:

```
/color/text 'bland' is not permitted — allowed: accent, brand, subtle
```

The loader itself reports configuration problems:

| Code                      | Meaning                                                                                                        |
| ------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `schema/unreadable`       | A `use` key or `$ref` does not resolve to a readable file.                                                      |
| `schema/no-op`            | The schema constrains nothing — an open schema lists names without closing them, which accepts every document while looking like enforcement. |
| `schema/dialect-mismatch` | The schema uses keywords its declared dialect ignores (e.g. draft-07 with `unevaluatedProperties`) — it enforces less than it reads. |
| `schema/remote-ref`       | A reference only a network fetch could satisfy.                                                                 |
| `schema/invalid-schema`   | The file is not valid JSON Schema.                                                                              |

None of these pass silently: a typo'd schema name or an accidentally-open schema is an
error, not "no constraints".

## Authoring vocabulary schemas

A vocabulary schema is ordinary JSON Schema. Published vocabulary packages
(`@vertekum/schema-atlassian` is one) supply theirs prebuilt; a project can also write
its own, or generate schemas from `.dfn` definition files with `@vertekum/schema-builder`.
