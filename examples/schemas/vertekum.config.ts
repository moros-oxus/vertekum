import { defineConfig } from '@vertekum/core';
import { schemaBuilderExtension } from '@vertekum/schema-builder';

/**
 * Three routes to a token vocabulary, in one project.
 *
 * Schemas are FILES, named here rather than registered by an extension. A group's `from` is a base —
 * a package specifier or a directory relative to this file — and `use` maps schemas within it to the
 * token files they govern. Mixing sources is just more entries: this project holds `semantic.json`
 * to Atlassian's colour names and `house.json` to a vocabulary of its own, and neither knows about
 * the other.
 */
export default defineConfig({
  collection: './tokens',

  // The builder contributes `vertekum schema build`: house.json below is BUILT from
  // schemas/house.dfn — declared as one grammar line, materialized as ordinary JSON Schema.
  extensions: [schemaBuilderExtension],

  schemas: [
    {
      from: './schemas',
      domain: 'vocabulary',
      use: {
        // ROUTE 1 — a schema DECLARED as grammar (schemas/house.dfn) and built by
        // `vertekum schema build`, for a set with a vocabulary of its own.
        'house.json': 'house.json',

        // ROUTE 2 — Atlassian's colour vocabulary, ejected and edited: one position added at
        // color.text granting the name `marketing`. The copy is ordinary source now.
        'color.json': 'semantic.json',

        // ROUTE 3 — a schema EJECTED from core, so this repo can change it:
        //   vertekum schema eject @vertekum/schema-dtcg/tokens.json ./schemas/dtcg-tokens.json
        // The `id` is what makes it REPLACE the binding core ships rather than layer a second copy
        // beside it, which would report every well-formedness error twice.
        'dtcg-tokens.json': {
          id: 'dtcg-tokens',
          match: '*',
          target: 'tokens',
          domain: 'schema',
        },
      },
    },
  ],
});
