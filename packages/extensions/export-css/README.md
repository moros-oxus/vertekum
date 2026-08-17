# @vertekum/ext-export-css

The CSS custom-properties exporter for Vertekum. Adds the `css` exporter, which writes a
resolved composition as custom properties — the base selection in `:root`, each modifier
context under its own selector.

## Enable

```ts
// vertekum.config.ts
import { cssExportExtension } from '@vertekum/ext-export-css';
import { defineConfig } from '@vertekum/core';

export default defineConfig({
  extensions: [cssExportExtension],
  targets: [{ id: 'web', exporter: 'css', composition: 'default', out: 'build/css' }],
});
```

`vertekum build` runs the target; `vertekum describe` lists the exporter and its options.

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `selector` | `attribute` | how variants are emitted: `attribute` → `[data-modifier="context"]` blocks; `media` → `prefers-color-scheme` queries for light/dark; `files` → one file per variant |
| `fileName` | `tokens.css` | name of the emitted stylesheet, relative to the target `out` dir |
| `colorSpace` | `oklch` | the colour space this target **emits** — deliberately not "the stored space", so delivery stays consistent when storage changes |
| `colorFormat` | `css` | `css` → the function form (`oklch(…)`, `color(display-p3 …)`); `hex` → `#rrggbb(aa)` computed from components (hex is sRGB, so it implies conversion) |

Options are declared to the exporter registry, so `vertekum check` validates a target's
options and `describe` publishes their schema.

A non-view extension: it contributes an exporter and nothing else.
