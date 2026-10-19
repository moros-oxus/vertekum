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

## CSS names keep their token's case

A custom property is named with the case its token path is authored in:
`color.neutral.A100` becomes `--color-neutral-A100` (with any prefix your `variableName`
adds), in its declaration and in every `var()` that references it. `@terrazzo/plugin-css`
lowercases the names it declares, even when a custom `variableName` produced them, while
its references keep that name as given. This exporter restores the token's own case in
every `.css` file the plugin writes, declarations and references together, so the two always
agree, whether or not your `variableName` lowercases.

Only names that match a token with a capital in its path change. A path with no capital
keeps its name, and so does a lowercase path that merely ends like a cased one. Two paths
that differ only by case (`x.A1` and `x.a1`) are ambiguous, so both keep the name the plugin
wrote.

A non-view extension: it contributes an exporter and nothing else. Terrazzo and its plugins
are dependencies a project chooses deliberately, which is why this exporter is opt-in.

## License

Apache-2.0
