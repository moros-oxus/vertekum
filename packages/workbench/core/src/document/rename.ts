import { formatPointer, isPointerObject, parsePointer } from '../dtcg/pointer';
import { isReference, referenceToPath } from '../dtcg/references';
import { DEFAULT_SET } from '../dtcg/serialize';
import type { Token } from './types';

/** What a rename would touch. Pure output — the caller decides whether to apply it. */
export interface RenamePlan {
  /** `from` is a prefix rather than a complete token path (i.e. a group). */
  isGroup: boolean;
  repathed: Array<{ id: string; set: string; path: string[] }>;
  /** Exactly one of `value` (a rewritten `$value` — curly string or pointer-carrying object) or
   *  `ref` (a rewritten token-position `$ref`) is set per entry. */
  rewritten: Array<{ id: string; set: string; value?: unknown; ref?: string }>;
  /** Resulting paths that cannot legally exist. Non-empty means: do not apply. */
  collisions: string[];
}

/** Segment-wise prefix test, so `color.gray.900` never matches `color.gray.9000`. */
function hasPrefix(path: string[], prefix: string[]): boolean {
  return (
    path.length >= prefix.length &&
    prefix.every((segment, i) => path[i] === segment)
  );
}

const setOf = (token: Token): string => token.set ?? DEFAULT_SET;

/**
 * Rewrite a pointer whose NAME PORTION (segments before the first `$value`) starts with `from`.
 * The tail — `$value` and anything after it — is an address into the value, not a name, and is
 * carried over untouched. Returns `undefined` when the pointer is unaffected.
 */
function rewritePointer(
  ref: string,
  from: string[],
  to: string[],
): string | undefined {
  const segments = parsePointer(ref);
  if (!segments) return undefined;
  const valueAt = segments.indexOf('$value');
  const names = valueAt === -1 ? segments : segments.slice(0, valueAt);
  if (!hasPrefix(names, from)) return undefined;
  return formatPointer([...to, ...segments.slice(from.length)]);
}

/** Deep-map a value, rewriting each pointer object's `$ref` through `fn`. Returns a new value. */
function rewritePointerObjects(
  value: unknown,
  fn: (ref: string) => string,
): unknown {
  if (isPointerObject(value)) return { $ref: fn(value.$ref) };
  if (Array.isArray(value)) {
    return value.map((v) => rewritePointerObjects(v, fn));
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = rewritePointerObjects(v, fn);
    }
    return out;
  }
  return value;
}

/**
 * Plan a rename of `from` to `to` (ADR-0012). A leaf and a group are the same operation: any token
 * whose path carries the `from` prefix is repathed, and any token whose value REFERENCES such a
 * path is rewritten. Renames apply across every set that shares the path, because composition
 * merges by path — renaming one set alone would split one themed token into two.
 */
export function planRename(
  tokens: Token[],
  from: string[],
  to: string[],
): RenamePlan {
  const moving = tokens.filter((token) => hasPrefix(token.path, from));
  const isGroup = !moving.some((token) => token.path.length === from.length);

  const repathed = moving.map((token) => ({
    id: token.id,
    set: setOf(token),
    path: [...to, ...token.path.slice(from.length)],
  }));

  const rewritten: RenamePlan['rewritten'] = [];
  for (const token of tokens) {
    if (isReference(token.value)) {
      const target = referenceToPath(token.value).split('.');
      if (!hasPrefix(target, from)) continue;
      const next = [...to, ...target.slice(from.length)];
      rewritten.push({
        id: token.id,
        set: setOf(token),
        value: `{${next.join('.')}}`,
      });
      continue;
    }
    if (token.ref !== undefined) {
      const next = rewritePointer(token.ref, from, to);
      if (next !== undefined) {
        rewritten.push({ id: token.id, set: setOf(token), ref: next });
      }
      continue;
    }
    if (token.sourceValue !== undefined) {
      let touched = false;
      const next = rewritePointerObjects(token.sourceValue, (ref) => {
        const rewrote = rewritePointer(ref, from, to);
        if (rewrote !== undefined) touched = true;
        return rewrote ?? ref;
      });
      if (touched) {
        rewritten.push({ id: token.id, set: setOf(token), value: next });
      }
    }
  }

  // Collisions are judged per set against the tokens that are NOT moving: a resulting path may not
  // already hold a token, sit underneath one, or sit where a group already is — DTCG allows a node
  // to have `$value` or children, never both.
  const movingIds = new Set(moving.map((token) => token.id));
  const staying = tokens.filter((token) => !movingIds.has(token.id));
  const collisions: string[] = [];
  for (const landing of repathed) {
    for (const token of staying) {
      if (setOf(token) !== landing.set) continue;
      const occupied = hasPrefix(token.path, landing.path);
      const nested = hasPrefix(landing.path, token.path);
      if (occupied || nested) {
        const clash = landing.path.join('.');
        if (!collisions.includes(clash)) collisions.push(clash);
      }
    }
  }

  return { isGroup, repathed, rewritten, collisions };
}
