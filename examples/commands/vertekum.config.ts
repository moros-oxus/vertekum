import css from '@terrazzo/plugin-css';
import { defineConfig } from '@vertekum/core';
import { terrazzoExportExtension } from '@vertekum/ext-export-terrazzo';
import { spacingShorthandExtension } from './extensions/spacing-shorthand';

/**
 * The command extension chain, end to end — see the README. One local extension declares a
 * `spacing` type (a schema patch), teaches `token add`/`token set` its shorthand and a type
 * inference (`ctx.commands.extend`), and presents the type at export so terrazzo renders it as
 * one custom property. Chain order, where it ever matters, is this `extensions: []` array.
 */
export default defineConfig({
  collection: './tokens',
  extensions: [spacingShorthandExtension, terrazzoExportExtension],
  targets: [
    {
      id: 'web',
      exporter: 'terrazzo',
      out: 'build/css',
      options: { plugins: [css({ filename: 'tokens.css' })] },
    },
  ],
});
