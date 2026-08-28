import { defineConfig } from '@vertekum/core';
import { cssExportExtension } from '@vertekum/ext-export-css';
import { textDecorationExtension } from './extensions/text-decoration';

/**
 * Two type extensions to the DTCG schema, one per route — see the README.
 * `textCase` arrives as a patch FILE bound here; `textDecoration` as a patch an
 * extension registers in code. Both merge into the effective DTCG schema at load.
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
  extensions: [cssExportExtension, textDecorationExtension],
});
