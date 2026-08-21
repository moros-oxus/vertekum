# Modules and composition

A vocabulary rarely fits one file: denotations shared across aspects live in fragment
modules, aspects live in their own modules, and one aggregate root unions them. `use`
is the composition mechanism.

```dfn
# schema.dfn — the aggregate
use "./color.dfn"
use "./space.dfn"

root = [<@color> | <@space>]
```

## `use`

`use "<specifier>"` imports a module; everything it declares becomes referenceable.

| Specifier form       | Example                              | Resolution                                                 |
| -------------------- | ------------------------------------ | ----------------------------------------------------------- |
| Relative path        | `use "./denotations/colors.dfn"`     | Relative to the importing module's own location.            |
| Package specifier    | `use "@acme/vocabulary/color.dfn"`   | The package's `exports` map first; else the path joined to the package root — so a content package need not map every `.dfn` individually. |

An import cycle is an authoring error, reported with the module that closes the loop.

### Import keys and `as`

Each import gets a **key**: its basename without `.dfn`, or the alias given with
`as`. The key is how references address the import. Two imports landing on the same
key — two `color.dfn` files from different directories — is an error naming the fix:

```dfn
use "./brand/color.dfn"
use "./system/color.dfn" as system-color
```

### Accessing an import

| Reference            | Means                                                                       |
| -------------------- | ---------------------------------------------------------------------------- |
| `<@key>`             | the imported module's **root** — the whole subtree it grants.                |
| `<@name>`            | the production `name`, searched across every import; unambiguous or an error. |
| `<@key/name>`        | qualified: that import's production alone — the collision resolver.           |

When two imports both declare `<accent>`, the unqualified `<@accent>` refuses with the
qualified form to use. Local productions (`<name>`, no `@`) never collide with imports.

## Fragments

A module without a `root` is a **fragment** — a library of denotations meant to be
imported, never built:

```dfn
# denotations/emphasis.dfn
emphasis = subtle | bold
```

The build sweep skips fragments with a notice (`… declares no root (a fragment) —
skipped`); naming one explicitly as the build argument is an error, so a module whose
`root` was mistyped cannot be silently skipped.

## Aggregate roots

A root that unions imported roots — `root = [<@color> | <@space>]` — composes a whole
vocabulary from aspect modules. Each module owns its top-level names: the same
top-level name arriving from two different imports is a **collision**, not a merge
(`top-level 'color' comes from both 'color' and 'palette'`). To co-validate aspects as
*separate* schemas over the same files instead, give each module
[`scope "branch"`](./language.md#pragmas) and bind them side by side.

## Nested directories

Modules may nest — `schemas/color.dfn` beside `schemas/palette/color.dfn` — and the
build preserves the structure: each built `.json` lands beside its own module. The
provenance stamp records the module's project-relative path, so same-named modules in
different directories stay distinguishable.

## Shipping and ejecting grammar

A package can ship its `.dfn` sources alongside the built schemas. An `exports` pattern
keeps flat specifiers working over a nested layout:

```json
{
  "exports": {
    "./*.json": "./lib/*.json",
    "./*.dfn": "./dfn/*.dfn"
  }
}
```

Consumers then eject the grammar rather than the generated JSON:

```bash
vertekum schema eject @acme/vocabulary/color.dfn ./schemas/color.dfn
vertekum schema build
```

Editing an ejected module keeps changes one-line grammar edits with a rebuild, instead
of surgery on generated schema. Two things to know:

- An ejected module that `use`s **relative** imports needs them ejected alongside it
  (package-specifier imports keep resolving).
- What the `schemas` config binds is the **built `.json`**, never the `.dfn` — the
  grammar is authoring source; core and `check` only ever see schema files.
