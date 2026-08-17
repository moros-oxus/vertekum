import type { ResolverDocument } from '../document/resolver-types';
import type { Token } from '../document/types';
import { materializeTokens } from '../dtcg/materialize';
import { resolveValues } from '../dtcg/resolve';
import type { ExporterInput } from './exporter';

/**
 * Build an ExporterInput from a resolver + tokens: `base` is the default selection, and one `variant` per
 * non-base modifier context (each fully resolved). The raw `resolver`/`tokens` ride along for exporters
 * that resolve with their own engine (e.g. terrazzo). Pure — the route and a future CLI build it identically.
 *
 * Each bundle is re-materialized: a `#/` pointer addresses the FLATTENED document (resolver spec),
 * so its target — and whether it resolves at all — depends on the selection that built the bundle.
 */
export function resolveExporterInput(
  resolver: ResolverDocument,
  tokens: Token[],
): ExporterInput {
  const base = materializeTokens(resolveValues(resolver, {}, tokens));
  const variants: ExporterInput['variants'] = [];
  for (const [modifier, mod] of Object.entries(resolver.modifiers)) {
    const contexts = Object.keys(mod.contexts);
    const baseCtx = mod.default ?? contexts[0];
    for (const context of contexts) {
      if (context === baseCtx) continue;
      variants.push({
        modifier,
        context,
        tokens: materializeTokens(
          resolveValues(resolver, { [modifier]: context }, tokens),
        ),
      });
    }
  }
  return { base, variants, resolver, tokens };
}
