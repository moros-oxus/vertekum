import { type DtcgNode, dtcg, type Token } from '@vertekum/core';

/**
 * Terrazzo 2.7 is 2025.10-native for `$root`, token-node `$ref`, and whole-`$value` references —
 * those pass through verbatim and survive as var() chains in the output. Exactly two probed
 * limitations need correcting before hand-off, both fragment-shaped and both silent:
 *
 *   1. a token-level `$ref` that crosses into `$value` is DROPPED (no token, no error);
 *   2. a value-position fragment ref resolves internally but emits the WHOLE target as var() —
 *      an entire colour where one component belongs.
 *
 * The correction swaps the authored notation for the value Vertekum already materialized. A ref
 * that never materialized (dangling) stays authored — terrazzo fails loudly, the same contract as
 * a dangling curly alias. Everything else — `$root`, aliases in the `$root` spelling, vendor
 * `$extensions` — is none of this module's business and passes byte-identical.
 */

/** Every segment is a NAME (`$root` is a child name) — the token-node form terrazzo aliases. */
function isTokenNodePointer(ref: string): boolean {
  const segments = dtcg.tokens.parsePointer(ref);
  return (
    !!segments && segments.every((s) => !s.startsWith('$') || s === '$root')
  );
}

/** Names + one final `$value` — the whole-value form terrazzo aliases in value position. */
function isWholeValuePointer(ref: string): boolean {
  const segments = dtcg.tokens.parsePointer(ref) ?? [];
  if (segments.at(-1) !== '$value') return false;
  return segments
    .slice(0, -1)
    .every((s) => !s.startsWith('$') || s === '$root');
}

/** Any `{"$ref"}` in this value pointing past a whole `$value` — the form terrazzo gets wrong. */
function hasFragmentRef(value: unknown): boolean {
  if (dtcg.tokens.isPointerObject(value)) {
    return !isWholeValuePointer(value.$ref);
  }
  if (Array.isArray(value)) return value.some(hasFragmentRef);
  if (value !== null && typeof value === 'object') {
    return Object.values(value).some(hasFragmentRef);
  }
  return false;
}

/**
 * A staged copy of one set tree with the two known limitations corrected, everything else
 * byte-identical. Materialized values come from the flat model core already built (`tokens`),
 * looked up by this set's (set, path).
 */
export function correctKnownLimitations(
  tree: DtcgNode,
  tokens: Token[],
  set: string,
): DtcgNode {
  const bySetPath = new Map(
    tokens.filter((t) => t.set === set).map((t) => [t.path.join('.'), t]),
  );

  const walk = (node: DtcgNode, path: string[]): DtcgNode => {
    const isToken = '$value' in node || typeof node.$ref === 'string';
    const token = bySetPath.get(path.join('.'));

    if (isToken) {
      const out: DtcgNode = { ...node };
      if (token === undefined || token.value === undefined) return out;
      if (typeof node.$ref === 'string' && !isTokenNodePointer(node.$ref)) {
        delete out.$ref;
        out.$value = token.value;
      } else if (
        '$value' in node &&
        hasFragmentRef(node.$value) &&
        // a dangling fragment kept its marker in the materialized value — stays authored
        !hasFragmentRef(token.value)
      ) {
        out.$value = token.value;
      }
      return out;
    }

    const out: DtcgNode = {};
    for (const [key, child] of Object.entries(node)) {
      const isChild =
        child !== null &&
        typeof child === 'object' &&
        !Array.isArray(child) &&
        (!key.startsWith('$') || key === '$root');
      out[key] = isChild ? walk(child as DtcgNode, [...path, key]) : child;
    }
    return out;
  };

  return walk(tree, []);
}
