import { defineConfig } from '@vertekum/core';
import { cssExportExtension } from '@vertekum/ext-export-css';
import { tokenRampExtension } from '@vertekum/ext-token-ramp';
import { textDecorationExtension } from './extensions/text-decoration';

/**
 * Three extensions — see the README. `textCase` arrives as a patch FILE bound
 * here; `textDecoration` as a patch an extension registers in code (both merge
 * into the effective DTCG schema at load); `tokenRampExtension` generates the
 * `color.teal` ramp from its anchor (a group `$extensions` payload).
 */
export default defineConfig({
  collection: './tokens',
  schemas: [
    {
      from: './schemas',
      use: { './text-case.json': '*' },
    },
  ],
  targets: [{ id: 'web', exporter: 'css', out: 'build/css' }],
  extensions: [cssExportExtension, textDecorationExtension, tokenRampExtension],
});
