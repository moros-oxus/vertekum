# Configuration

A Vertekum project is configured by one file, `vertekum.config.ts`, at the project root.
The file's location is the **working directory**: the token collection, export outputs, and
the system-governed `.vertekum/` directory all resolve relative to it. The `vertekum` CLI
finds the config by walking up from the current directory.

Config states what **is** — which collection, which schemas, which export targets. What
**can** be configured (registered exporters and their option schemas, validators,
compositions) is reported by `vertekum describe`; the config never has to enumerate
capability, only choice.

## Example

The essentials — where the tokens live, what validates them, what gets built:

```ts
import { defineConfig } from '@vertekum/core';
import { cssExportExtension } from '@vertekum/ext-export-css';

export default defineConfig({
  // the DTCG token files, relative to this file
  collection: './tokens',

  // the vocabulary this project is held to: schema files → the collection files they validate
  schemas: [{ from: './schemas', use: { 'color-schema.json': '*' } }],

  // extensions contribute capability — here, the `css` exporter the target below runs
  extensions: [cssExportExtension],

  // configured export runs: an exporter, over a composition, writing somewhere
  targets: [{ exporter: 'css', composition: 'default', out: 'build/css' }],
});
```

`defineConfig` is an identity helper — it exists for type-checking and editor completion.
It also accepts a function of the environment, for conditional config:

```ts
export default defineConfig(({ command, mode }) => ({
  collection: './tokens',
  targets: command === 'build' ? productionTargets : [],
}));
```

`command` is `'serve'` or `'build'`; `mode` is a free string.

## Fields

Every field is optional; each section below summarizes the field's role and links to the
page that covers it in full.

| Field                                   | What it configures                                                        |
| --------------------------------------- | ------------------------------------------------------------------------- |
| [`collection`](#collection)             | Where the DTCG token files live.                                          |
| [`schemas`](#schemas)                   | The vocabulary the collection is validated against.                       |
| [`targets`](#targets)                   | The configured export runs (`vertekum build`).                            |
| [`extensions`](#extensions)             | Which extensions the host loads, optionally configured inline.            |
| [`settings`](#settings)                 | Extension setting overrides, keyed by extension id.                       |
| [`defaultColorSpace`](#defaultcolorspace) | The colour space written when colour values are created or migrated.    |
| [`format`](#format)                     | How generated JSON is indented.                                           |
| [`storage`](#storage)                   | The storage backend (browser-side only).                                  |

### `collection`

Where the DTCG token files live, relative to the config file. Every `*.json` file in this
directory is part of the collection: `<set>.json` files are token sets,
`<name>.resolver.json` files are resolver documents.

Details: [tokens](./tokens.md), [resolvers](./resolvers.md).

### `schemas`

The schemas this project is held to — its vocabulary. DTCG well-formedness is always
checked, whether or not this field is present; configured schemas layer on top of it.
Each entry is a group: one base (`from`) and a map (`use`) of schema file → the
collection files it validates.

Details: [schema validation](./schemas.md) — the group and `use` shapes, every field's
values, ejection, diagnostics.

### `targets`

The configured export runs: which exporter, over which composition, writing where, with
what options. `vertekum build` runs them; a target is a declaration, so the same export
is repeatable and reviewable. A target's `composition` names a resolver document from the
collection — this is where [export](./export.md) and [theming](./resolvers.md) meet.

Details: [export](./export.md) — every target field, its values, and the run model.

### `extensions`

What the host loads. An entry is an extension, an inline-configured extension (called
with its settings, Vite-plugin style), or an array of these (a bundle that expands to
several):

```ts
extensions: [
  cssExportExtension,                 // uncalled: defaults only
  tokensExtension({ showIds: true }), // inline-configured
],
```

Inline options become host-level setting overrides. A later duplicate extension id
replaces an earlier one wholesale. Exporter extensions are covered in
[export](./export.md#registering-an-exporter).

### `settings`

The same overrides as inline configuration, keyed by extension id — useful when the
override is decided away from the entry:

```ts
settings: {
  'vtk.tokens': { showIds: true },
},
```

The `settings` map is applied last and wins per id.

### `defaultColorSpace`

The colour space written when a colour value is created or migrated (any space from the
DTCG format's set; default `'oklch'`). This governs **storage** — delivery is a separate
choice an export target makes in its `options`.

Details: [tokens § values](./tokens.md#values).

### `format`

How generated JSON is indented: a number of spaces or a literal string (`'\t'`); default
`2`. Set it to whatever the project's formatter produces — a tool's output should not
fight the formatter that already runs.

### `storage`

Browser-side only: a factory returning the storage backend the app talks to. Defaults to
the local bridge. Headless consumers and the CLI ignore it.

## Merging

When a host supplies a base config (as the browser app does), the system composes the
project's config over it with `mergeVertekumConfig`. Every field is
**override-or-inherit** — a field the project sets replaces the base's value wholesale —
except `settings`, which merges two levels deep (per extension id, then per setting key).

One consequence worth knowing: a project declaring any `schemas` declares **all** of them.
The arrays do not concatenate — concatenation would make a base schema impossible to
remove.
