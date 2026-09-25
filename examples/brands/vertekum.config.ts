import css from '@terrazzo/plugin-css';
import { defineConfig } from '@vertekum/core';
import { figmaExportExtension } from '@vertekum/ext-export-figma';
import { terrazzoExportExtension } from '@vertekum/ext-export-terrazzo';
import { tokenRampExtension } from '@vertekum/ext-token-ramp';

/**
 * A reference structure for brand × color scheme × sub-theme. Each axis owns exactly ONE
 * decision, and everything else composes through aliases — nothing is multiplied out:
 *
 * - **brand** (a composition per brand) owns *which colours exist*: `{brand}/palette.json` holds
 *   anchors and the ramps generated from them. The only file that differs per brand.
 * - **sub-theme** (modifier) owns *which ramp is "accent"*: `accent.*` aliases a ramp's steps.
 * - **color-scheme** (modifier) owns *which step a role uses*: `surface.background` → light
 *   `{color.neutral.100}`, dark `{color.neutral.900}`. Aliases only, so both brands SHARE it.
 * - **core** (set) holds the scales nothing varies.
 *
 * `action.background` (scheme) → `accent.700` (sub-theme) → `color.brand.700` (palette): a frame
 * picks one mode per axis and the alias chain resolves the combination.
 *
 * In Figma that is four small collections — `core`, `palette` (per brand), `sub-theme` (the
 * brand/sub-theme pairs that exist), `color-scheme` (light/dark, shared) — decided by which files
 * each resolver references, so the structure never moves when a value changes.
 */
const brand = (name: string) => ({
  id: `css-${name}`,
  exporter: 'terrazzo',
  composition: name,
  out: `output/css/${name}`,
  options: { plugins: [css({ filename: `${name}.css` })] },
});

export default defineConfig({
  collection: './tokens',
  extensions: [
    tokenRampExtension(),
    terrazzoExportExtension,
    figmaExportExtension,
  ],
  targets: [
    brand('acme'),
    brand('globex'),
    {
      id: 'figma',
      exporter: 'figma',
      compositions: ['acme', 'globex'],
      out: 'output/figma',
    },
  ],
});
