/**
 * RFC 6901 JSON Pointers in their URI-fragment representation — the notation DTCG 2025.10 uses for
 * `$ref` (format.json: `format: "json-pointer-uri-fragment"`, pattern `^#/`). `#` addresses THIS
 * document, which in Vertekum is the set file the pointer appears in.
 */

/** `#/a/b` → decoded segments; `undefined` for anything that is not a same-document pointer. */
export function parsePointer(ref: string): string[] | undefined {
  if (!ref.startsWith('#/')) return undefined;
  try {
    return ref
      .slice(2)
      .split('/')
      .map((segment) =>
        decodeURIComponent(segment).replaceAll('~1', '/').replaceAll('~0', '~'),
      );
  } catch {
    // A malformed percent-sequence is a miss, not a crash — the format binding flags the file.
    return undefined;
  }
}

/** Segments → `#/…` with 6901 escaping (the write-side counterpart of `parsePointer`). */
export function formatPointer(segments: string[]): string {
  return `#/${segments
    .map((segment) => segment.replaceAll('~', '~0').replaceAll('/', '~1'))
    .join('/')}`;
}

/** Walk `segments` down a JSON tree. Arrays take base-10 indices without leading zeros (RFC 6901 §4). */
export function evaluatePointer(tree: unknown, segments: string[]): unknown {
  let node: unknown = tree;
  for (const segment of segments) {
    if (Array.isArray(node)) {
      if (!/^(0|[1-9]\d*)$/.test(segment)) return undefined;
      node = node[Number(segment)];
    } else if (node !== null && typeof node === 'object') {
      if (!Object.hasOwn(node, segment)) return undefined;
      node = (node as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return node;
}

/** Exactly `{ $ref: string }` — DTCG's value-position pointer object. */
export function isPointerObject(value: unknown): value is { $ref: string } {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof (value as { $ref?: unknown }).$ref === 'string' &&
    Object.keys(value).length === 1
  );
}
