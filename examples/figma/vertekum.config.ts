import { defineConfig } from '@vertekum/core';
import { figmaExportExtension } from '@vertekum/ext-export-figma';
import { microsoftManifest } from '@vertekum/figma-dialect-microsoft';

/**
 * The figma exporter, end to end. One composition with two modifiers resolves into the
 * Figma-shaped model — each resolver set a single-mode collection, each modifier a collection
 * whose contexts are its modes — emitted as `figma.model.json` (the canonical, versioned
 * artifact), plus the Microsoft `figma-variables-import` dialect (a separate contribution
 * package, the way terrazzo plugins are).
 *
 * Not every Figma seat has multi-mode collections, so the dialect's `modes` option adjusts the
 * OUTPUT while the model keeps full fidelity — one target per strategy below, with outputs
 * COMMITTED under `output/` for import testing against real Figma seats.
 */
export default defineConfig({
  collection: './tokens',
  extensions: [figmaExportExtension],
  targets: [
    {
      id: 'figma-native',
      exporter: 'figma',
      composition: 'default',
      out: 'output/native',
      options: { dialects: [microsoftManifest({ modes: 'native' })] },
    },
    {
      id: 'figma-split-collections',
      exporter: 'figma',
      composition: 'default',
      out: 'output/split-collections',
      options: {
        dialects: [microsoftManifest({ modes: 'split-collections' })],
      },
    },
    {
      id: 'figma-split-files',
      exporter: 'figma',
      composition: 'default',
      out: 'output/split-files',
      options: { dialects: [microsoftManifest({ modes: 'split-files' })] },
    },
  ],
});
