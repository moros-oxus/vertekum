import {
  type Extension,
  SCHEMA_BINDING_SERVICE,
  type SchemaBindingService,
} from '@vertekum/core';
import TEXT_DECORATION_PATCH from '../schemas/text-decoration.json';

/**
 * The extension route to the same mechanism `schemas/text-case.json` uses from config: a patch
 * document — kept as a schema FILE beside text-case.json — registered in code. This one goes
 * further than textCase: besides declaring the `textDecoration` type, it extends the
 * `typography` COMPOUND, so a typography value may carry a `textDecoration` member.
 *
 * Targets are anchors of the effective DTCG schema (`dtcg#…` — run `vertekum describe` to see
 * the bindings in effect). Merge semantics are additive: `enum` unions, `allOf` appends,
 * objects deep-merge. Narrowing is what LAYERED schemas do; extending only ever adds.
 */
export const textDecorationExtension: Extension = {
  manifest: { id: 'example.text-decoration', name: 'Text decoration type' },
  activate(ctx) {
    ctx.services.get<SchemaBindingService>(SCHEMA_BINDING_SERVICE)?.register({
      match: '*',
      target: 'tokens',
      schema: TEXT_DECORATION_PATCH,
    });
  },
};
