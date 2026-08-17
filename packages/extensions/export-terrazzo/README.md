# @vertekum/ext-export-terrazzo

The terrazzo bridge for Vertekum. Adds the `terrazzo` exporter, which formats a resolved
composition through the [terrazzo](https://terrazzo.app) plugin toolchain — CSS, JS/TS,
Tailwind, native platforms — as configured export targets.

## Enable

```ts
// vertekum.config.ts
import { terrazzoExportExtension } from '@vertekum/ext-export-terrazzo';
import { defineConfig } from '@vertekum/core';
import css from '@terrazzo/plugin-css';

export default defineConfig({
  extensions: [terrazzoExportExtension],
  targets: [
    {
      id: 'web',
      exporter: 'terrazzo',
      composition: 'default',
      out: 'build/terrazzo',
      options: { plugins: [css()] },
    },
  ],
});
```

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `plugins` | `[]` | terrazzo plugin instances, e.g. `css()` from `@terrazzo/plugin-css`. **No plugins means no output.** |
| `lint` | — | terrazzo lint rule overrides, merged over this exporter's defaults |

The options surface is strict and exposes exactly the tool configuration that does not
overlap the run contract: the runner owns placement and sources — the target's `out` is the
output directory, and the project's token files are the sources — so a colliding terrazzo
key fails loudly rather than being silently dropped.

A non-view extension: it contributes an exporter and nothing else. Terrazzo and its plugins
are dependencies a project chooses deliberately, which is why this exporter is opt-in.

## License

Apache-2.0
