/**
 * Structural sharing for emitted schemas.
 *
 * A generative syntagm with optional slots (`color.<pattern>?.<property>.<role>?.<state>?`)
 * repeats the TAIL of the expression under every enumerated sibling name — byte-identical
 * subtrees, hundreds of kilobytes each, multiplied into megabytes (a consumer module reached
 * 12 MB / 22k ref-sites, and ajv's compiled validator overflowed the call stack). This pass
 * hoists every repeated schema subtree into `$defs` once and references it — validation
 * behaviour is unchanged because 2020-12 `unevaluatedProperties` sees through `$ref`.
 *
 * Only nodes in SCHEMA POSITION are candidates: hoisting the object under `properties` itself
 * would turn a keyword map into `{ "$ref": … }`, which is a property named `$ref`, not a
 * reference. Names are content-derived (`shared-<hash>`), so rebuilds stay diff-stable.
 */

type Json = Record<string, unknown>;

/** Keywords whose value is a map of name → schema. */
const SCHEMA_MAPS = new Set(['properties', 'patternProperties', '$defs']);
/** Keywords whose value is an array of schemas. */
const SCHEMA_LISTS = new Set(['allOf', 'anyOf', 'oneOf']);
/** Keywords whose value is a single schema (when it is an object). */
const SCHEMA_VALUES = new Set([
  'additionalProperties',
  'unevaluatedProperties',
  'items',
  'not',
  'if',
  'then',
  'else',
]);

/**
 * Only subtrees at least this large hoist. Small repetition is deliberate emission style (a
 * shared `allOf` pair reads better inline, and tests pin those shapes); the pathology this pass
 * exists for repeats subtrees of hundreds of kilobytes.
 */
const MIN_BYTES = 512;

/** FNV-1a over a string, as fixed-width hex — composition-friendly and dependency-free. */
function fnv(input: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let i = 0; i < input.length; i++) {
    hash ^= BigInt(input.charCodeAt(i));
    hash = (hash * prime) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, '0');
}

/** Visit every schema-position object under `schema` (excluding `schema` itself). */
function visitChildren(
  schema: Json,
  visit: (child: Json, replace: (next: Json) => void) => void,
): void {
  for (const [key, value] of Object.entries(schema)) {
    if (SCHEMA_MAPS.has(key) && value && typeof value === 'object') {
      const map = value as Json;
      for (const [name, child] of Object.entries(map)) {
        if (child && typeof child === 'object' && !Array.isArray(child)) {
          visit(child as Json, (next) => {
            map[name] = next;
          });
        }
      }
    } else if (SCHEMA_LISTS.has(key) && Array.isArray(value)) {
      value.forEach((child, index) => {
        if (child && typeof child === 'object' && !Array.isArray(child)) {
          visit(child as Json, (next) => {
            (value as unknown[])[index] = next;
          });
        }
      });
    } else if (
      SCHEMA_VALUES.has(key) &&
      value &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      visit(value as Json, (next) => {
        schema[key] = next;
      });
    }
  }
}

/**
 * Hoist repeated subtrees of `document` into its `$defs`, in place. Iterates to a fixpoint:
 * hoisting inner duplicates makes outer subtrees identical, which the next round catches.
 */
export function dedupeSubtrees(document: Json): void {
  const defs = (): Json => {
    if (!document.$defs || typeof document.$defs !== 'object') {
      document.$defs = {};
    }
    return document.$defs as Json;
  };
  const reserved = new Set(Object.keys((document.$defs as Json) ?? {}));

  for (let round = 0; round < 32; round++) {
    // Pass 1: post-order signatures (composed from child hashes — compact and linear).
    const signature = new Map<Json, string>();
    const size = new Map<Json, number>();
    const buckets = new Map<string, Json[]>();
    const sign = (node: Json): string => {
      const held = signature.get(node);
      if (held) return held;
      visitChildren(node, (child) => {
        sign(child);
      });
      const parts: string[] = [];
      let bytes = 2;
      for (const key of Object.keys(node).sort()) {
        const value = node[key];
        parts.push(`${key}:${serialize(value)}`);
        bytes += key.length + byteLength(value);
      }
      const hash = fnv(parts.join('|'));
      signature.set(node, hash);
      size.set(node, bytes);
      const bucket = buckets.get(hash) ?? [];
      bucket.push(node);
      buckets.set(hash, bucket);
      return hash;
    };
    const serialize = (value: unknown): string => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return `#${sign(value as Json)}`;
      }
      return JSON.stringify(value) ?? 'null';
    };
    const byteLength = (value: unknown): number => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return size.get(value as Json) ?? 16;
      }
      return (JSON.stringify(value) ?? 'null').length;
    };

    // The whole forest: the document body plus every existing def.
    const roots: Json[] = [document];
    signature.set(document, 'root'); // the document itself is never a candidate
    visitChildren(document, (child) => {
      sign(child);
    });

    // Pass 2: pick duplicated, big-enough subtrees; verify true equality (hash paranoia).
    const hoisted = new Map<string, { name: string; canonical: string }>();
    for (const [hash, bucket] of buckets) {
      if (bucket.length < 2) continue;
      const first = bucket[0] as Json;
      if ((size.get(first) ?? 0) < MIN_BYTES) continue;
      if (Object.keys(first).length === 1 && '$ref' in first) continue;
      const canonical = JSON.stringify(first);
      if (bucket.some((node) => JSON.stringify(node) !== canonical)) continue;
      let name = `shared-${hash.slice(0, 8)}`;
      while (reserved.has(name)) name = `shared-${fnv(name).slice(0, 8)}`;
      hoisted.set(hash, { name, canonical });
    }
    if (hoisted.size === 0) return;

    // Pass 3: replace every occurrence top-down (an outer hoist swallows its inner ones this
    // round; the next round dedupes inside the new defs).
    const defsMap = defs();
    const replaceIn = (node: Json): void => {
      visitChildren(node, (child, replace) => {
        const hash = signature.get(child);
        const hit = hash === undefined ? undefined : hoisted.get(hash);
        if (hit) {
          if (!(hit.name in defsMap)) {
            defsMap[hit.name] = JSON.parse(hit.canonical);
            reserved.add(hit.name);
          }
          replace({ $ref: `#/$defs/${hit.name}` });
          return;
        }
        replaceIn(child);
      });
    };
    for (const root of roots) replaceIn(root);
  }
}
