import type { Token } from '../document/types';
import { type DtcgNode, ROOT_TOKEN } from './parse';
import { evaluatePointer, isPointerObject, parsePointer } from './pointer';
import { serializeCollection } from './serialize';

/**
 * Pointer materialization against the COMPOSED document.
 *
 * The resolver module fixes the scope: "aliases MUST NOT be resolved until [the ordering] has been
 * flattened into a single tokens structure" — a `#/` pointer addresses the flattened document, not
 * the set file it happens to sit in. `materializeTokens` therefore takes a token list that IS a
 * document — the whole collection merged (the flat scope, applied at parse), or one composed bundle
 * (applied per resolver selection) — rebuilds its tree, and resolves every pointer against it.
 *
 * Recomputation always starts from the AUTHORED notation (`ref`, `sourceValue`), never from a
 * previously materialized `value`, so the same token can be re-materialized under any composition.
 */

/** A node with a string `$ref` and no `$value` — the token-position pointer form. */
function isRefNode(node: unknown): node is DtcgNode {
  return (
    node !== null &&
    typeof node === 'object' &&
    !('$value' in (node as DtcgNode)) &&
    typeof (node as DtcgNode).$ref === 'string'
  );
}

/**
 * Evaluate one pointer to the VALUE it denotes, chaining through `$ref` tokens. The landing kind is
 * decided by ADDRESS, not by the target's shape — a composite `$value` whose members are all
 * objects (a shadow) is shape-indistinguishable from a group. Segments before any `$`-property are
 * name space (`$root` is a child NAME, not a property) and must land on a token node, which denotes
 * its value; crossing `$value`/`$type`/… enters property space, where the pointer denotes the JSON
 * at that location. `seen` holds pointer strings — revisiting one is a cycle.
 */
function resolvePointer(
  tree: DtcgNode,
  ref: string,
  seen: Set<string>,
): { value?: unknown; issue?: 'dangling' | 'cycle' } {
  if (seen.has(ref)) return { issue: 'cycle' };
  const segments = parsePointer(ref);
  if (!segments) return { issue: 'dangling' };
  const target = evaluatePointer(tree, segments);
  if (target === undefined) return { issue: 'dangling' };
  const next = new Set(seen).add(ref);
  if (isRefNode(target)) {
    return resolvePointer(tree, String(target.$ref), next);
  }
  const inPropertySpace = segments.some(
    (s) => s.startsWith('$') && s !== ROOT_TOKEN,
  );
  if (inPropertySpace) {
    return { value: resolveDeep(tree, target, next, { yes: false }) };
  }
  if (
    target !== null &&
    typeof target === 'object' &&
    '$value' in (target as DtcgNode)
  ) {
    // A token node denotes its value — which may itself carry value-position pointers.
    return {
      value: resolveDeep(tree, (target as DtcgNode).$value, next, {
        yes: false,
      }),
    };
  }
  return { issue: 'dangling' }; // a name-space landing that is not a token: a group, or a bare leaf
}

/** Deep-copy `value`, replacing pointer objects with their targets. Misses keep the object as a marker. */
function resolveDeep(
  tree: DtcgNode,
  value: unknown,
  seen: Set<string>,
  changed: { yes: boolean },
): unknown {
  if (isPointerObject(value)) {
    changed.yes = true;
    const result = resolvePointer(tree, value.$ref, seen);
    return result.issue ? value : result.value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => resolveDeep(tree, v, seen, changed));
  }
  if (value !== null && typeof value === 'object') {
    const out: DtcgNode = {};
    for (const [k, v] of Object.entries(value as DtcgNode)) {
      out[k] = resolveDeep(tree, v, seen, changed);
    }
    return out;
  }
  return value;
}

/**
 * Materialize every pointer reference in `tokens` against the composed tree the list itself forms
 * (last-wins by path, like `indexByPath`). Returns new tokens; the input is never mutated. A token
 * whose pointer fails carries `refIssue`; a value-position miss leaves its `{"$ref"}` marker in
 * place for the validator.
 */
export function materializeTokens(tokens: Token[]): Token[] {
  const tree = serializeCollection(tokens);
  return tokens.map((token) => {
    if (token.ref !== undefined) {
      const { refIssue: _stale, ...rest } = token;
      const result = resolvePointer(tree, token.ref, new Set());
      return result.issue
        ? { ...rest, value: undefined, refIssue: result.issue }
        : { ...rest, value: result.value };
    }
    // Recompute from the authored notation when present; otherwise detect markers on first pass.
    const source = token.sourceValue ?? token.value;
    const changed = { yes: false };
    const value = resolveDeep(tree, source, new Set(), changed);
    if (!changed.yes) return token;
    return { ...token, sourceValue: source, value };
  });
}
