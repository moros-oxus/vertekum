import type { Token } from '../document/types';
import { ROOT_TOKEN } from './parse';

/** True when a value is a DTCG reference — a non-empty string wrapped in braces, e.g. `{color.brand}`. */
export function isReference(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const s = value.trim();
  return s.length > 2 && s.startsWith('{') && s.endsWith('}');
}

/** The bare path of a reference (`{a.b}` → `a.b`); `''` when the value is not a reference. */
export function referenceToPath(value: unknown): string {
  return isReference(value) ? String(value).trim().slice(1, -1).trim() : '';
}

/** Build a dotted-path → token index for reference resolution (references cross groups). */
export function indexByPath(tokens: Token[]): Map<string, Token> {
  const map = new Map<string, Token>();
  for (const token of tokens) map.set(token.path.join('.'), token);
  // A `$root` token is ALSO addressable by its group's path: `{color.steel}` resolves to
  // `color.steel.$root`. That is the spec's design — `$root` never appears in a reference (the
  // format schema forbids `$` segments), exactly as it never appears in an exported name.
  // Collision-safe by construction: DTCG forbids a node being both token and group, so the group
  // path cannot name a real token. Registered after the literal paths so an explicit token always
  // wins over a root fallback across sets.
  for (const token of tokens) {
    if (token.path.at(-1) !== ROOT_TOKEN) continue;
    const group = token.path.slice(0, -1).join('.');
    if (!map.has(group)) map.set(group, token);
  }
  return map;
}

/**
 * Resolve a token's effective value, following DTCG references (`{a.b.c}`) through the path index.
 * Read-only. Returns `undefined` when a reference target is missing or a cycle is detected.
 */
export function resolveValue(
  token: Token,
  byPath: Map<string, Token>,
  seen: Set<string> = new Set(),
): unknown {
  const value = token.value;
  if (!isReference(value)) return value;
  if (seen.has(token.id)) return undefined; // cycle
  const target = byPath.get(referenceToPath(value));
  if (!target) return undefined;
  return resolveValue(target, byPath, new Set(seen).add(token.id));
}

/**
 * Opt-in dereference: replace each token's reference value with its literal, resolved against THIS set
 * (`indexByPath` of the given tokens). Unresolvable references (dangling / cycle) are kept as-is — never
 * `undefined`, never throws. Returns new tokens.
 */
export function flatten(tokens: Token[]): Token[] {
  const byPath = indexByPath(tokens);
  return tokens.map((t) => {
    if (!isReference(t.value)) return t;
    const resolved = resolveValue(t, byPath);
    return resolved === undefined ? t : { ...t, value: resolved };
  });
}
