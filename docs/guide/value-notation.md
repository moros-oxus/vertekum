# Value notation in Vertekum

How token values are written, stored, and delivered — the Vertekum-side workflow around the
2025.10 value objects.

## The model: short form in, spec form stored

Verbs accept the ergonomic form and store the spec object, keyed by the token's **effective** type
(explicit `--type`, or inherited from the group):

```
$ vertekum token add color.x '#ff00ff' --type color
```

stores

```json
{ "colorSpace": "oklch", "components": [0.7017, 0.3225, 328.3634], "alpha": 1, "hex": "#ff00ff" }
```

Three types transform — `color` (hex, CSS colour functions, named colours), `dimension` (`4px`,
`0.25rem`), `duration` (`200ms`, `0.2s`). Everything else is already spec-true as written:
`fontWeight` keywords are legal values, composites arrive as JSON. References (`"{color.base}"`)
and JSON objects always pass through untouched, and unparseable input for a transforming type is
a verb error naming the accepted forms.

## Storage space: `defaultColorSpace`

A root config property, sibling to `collection`:

```ts
defaultColorSpace: 'oklch',   // default; any of the spec's 14 spaces
```

This governs what verbs and `migrate values` WRITE. Delivery is a separate choice.

## Delivery: per-target exporter options

```ts
targets: [
  { id: 'web', exporter: 'css', composition: 'default', out: 'build/css',
    options: { colorSpace: 'srgb', colorFormat: 'hex' } },
]
```

- `colorSpace` — the space colours are emitted in. **Fixed default `oklch`**, deliberately not
  "the stored space": delivery stays consistent even when storage changes. Conversion runs only
  for values not already in the target space.
- `colorFormat: 'css' | 'hex'` — the function form (default), or `#rrggbb`/`#rrggbbaa` computed
  from components. Hex is sRGB by definition, so it implies srgb conversion.

## Migrating an existing repo

```
$ vertekum migrate values --dry-run   # review what would change
$ vertekum migrate values             # convert; rerunnable and idempotent
```

Parse-or-report-untouched: an unparseable value is listed with its path and left alone (exit 1
flags it). References are never touched. Group-typed string values that predate migration keep
passing validation (the format schema cannot see inheritance) — migration is how they gain teeth.

## The app's value editors

Editing object notation in the UI is a recorded follow-up: today a non-string value renders as a
blank editor (ADR-0028) rather than crashing.
