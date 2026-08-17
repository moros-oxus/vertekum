import css from '@terrazzo/plugin-css';
import js from '@terrazzo/plugin-js';
import { terrazzoExportExtension } from '@vertekum/ext-export-terrazzo';
import { defineConfig } from 'vertekum';

/**
 * Terrazzo-driven outputs: Vertekum passes the token and resolver FILES to terrazzo and runs it;
 * terrazzo resolves the composition and formats through its plugins. Everything terrazzo —
 * plugins, lint — is configured here, in one place, and nowhere else.
 *
 * The css()/js() imports are terrazzo's own plugins, this example's dependencies — Vertekum holds
 * no opinion on export targets or plugin choice; that is the consumer's domain.
 *
 * The ONLY extension is the terrazzo bridge. It creates the exporter registry itself, and every
 * validator — references, resolver semantics, target shapes — runs from core with no install:
 * naming an unknown exporter or misshaping a target's options is a `check` error here, with
 * nothing else imported.
 */

// Terrazzo configuration shared across targets: config is TypeScript, so reuse is a const and a
// spread — no mechanism.
const terrazzo = {
  lint: {},
};

export default defineConfig({
  collection: './tokens',
  extensions: [terrazzoExportExtension],
  targets: [
    // A target is one configured RUN (ADR-0018): exporter × composition × output dir — a second
    // target exists because a second COMPOSITION does, never because of plugins. `composition`
    // names the resolver FILE terrazzo executes; each plugin names its own output files; `out`
    // names the directory Vertekum writes into (terrazzo never writes).
    {
      id: 'default',
      exporter: 'terrazzo',
      composition: 'default', // default.resolver.json: core + the theme modifier
      out: 'build/default',
      // One run, two plugins: terrazzo formats any number of outputs in a single pass.
      options: {
        ...terrazzo,
        plugins: [css({ filename: 'tokens.css' }), js()],
      },
    },
    {
      id: 'docs',
      exporter: 'terrazzo',
      composition: 'docs', // docs.resolver.json: the leaner selection a docs site consumes
      out: 'build/docs',
      options: { ...terrazzo, plugins: [css({ filename: 'docs.css' })] },
    },
  ],
});
