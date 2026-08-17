# Outputs — terrazzo-driven exports

Vertekum passes the token and resolver files to [terrazzo](https://terrazzo.app)
and runs it; terrazzo resolves the composition and formats through its plugins.
All terrazzo configuration — plugins, lint — lives in one place:
`vertekum.config.ts`.

## Run it

```sh
pnpm check   # spec validation: format, references, resolver semantics
pnpm build   # runs every target
```

## What each target produces

| Target | Composition (resolver file) | Plugins | Writes |
| --- | --- | --- | --- |
| `default` | `default.resolver.json` | `css({ filename: 'tokens.css' })`, `js()` | `build/default/tokens.css`, `build/default/index.js`, `build/default/index.d.ts` |
| `docs` | `docs.resolver.json` | `css({ filename: 'docs.css' })` | `build/docs/docs.css` |

A target is one configured run: exporter × composition × output directory. A
second target exists because a second **composition** does — never because of
plugins, since terrazzo formats any number of plugins in a single pass (the
`default` target emits CSS and a JS module together). The plugin names each
output file; `out` names the directory Vertekum writes into; terrazzo itself
never touches the filesystem for output.

Many targets over the same options need no special syntax — the config is
TypeScript:

```ts
targets: ['default', 'docs'].map((name) => ({
  exporter: 'terrazzo',
  composition: name,
  out: `build/${name}`,
  options: { ...terrazzo, plugins: [css()] },
})),
```

Break out of the map the moment a composition needs different plugins — as
`docs` does here.

## What the tokens show

- **`$root`** (`color.text.$root`): a group carrying its own value. Terrazzo
  names it `--color-text` — the group's name, no `$root` anywhere in output.
- **Curly alias in the `$root` spelling** (`{color.text.$root}`): resolves and
  emits `--color-link: var(--color-text)`.
- **JSON Pointer reference** (`"$ref": "#/color/blue"`): emits
  `--color-accent: var(--color-blue)` — the reference chain survives to CSS.
- **Property-level reference** (`"$ref": "#/color/blue/$value/components/1"`):
  a number extracted from a colour. Emits the literal `--chroma-accent: 0.2152`
  (Vertekum materializes property-level fragments before hand-off).
- **Theme modifier** (`light`/`dark` contexts): terrazzo resolves the default
  context into the main output — `--surface` above is `light`'s. How contexts
  beyond the default surface in output is a terrazzo/plugin concern; the `js()`
  output carries the resolver's permutations.
