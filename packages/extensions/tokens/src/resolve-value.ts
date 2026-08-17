import { dtcg, type Token } from 'vertekum';

// The pure reference primitives (`isReference`/`referenceToPath`/`indexByPath`/`resolveValue`) now
// live in core (`dtcg.tokens.*`). This file keeps the editor-flavored validation helpers.

export type ReferenceIssue = 'dangling' | 'cycle' | 'type-mismatch';

/** Same-`$type` token paths (dotted), excluding `excludeId`, sorted — the datalist candidates. */
export function referenceCandidates(
  tokens: Token[],
  type: string,
  excludeId: string,
): string[] {
  return tokens
    .filter((t) => t.type === type && t.id !== excludeId)
    .map((t) => t.path.join('.'))
    .sort();
}

/** Does `targetPath`'s reference chain lead back to `currentId`? */
function reachesToken(
  targetPath: string,
  currentId: string,
  byPath: Map<string, Token>,
): boolean {
  let node = byPath.get(targetPath);
  const seen = new Set<string>();
  while (node) {
    if (node.id === currentId) return true;
    if (seen.has(node.id)) return false; // a cycle that does not involve currentId
    seen.add(node.id);
    const v = node.value;
    if (!dtcg.tokens.isReference(v)) return false;
    node = byPath.get(dtcg.tokens.referenceToPath(v));
  }
  return false; // dangling mid-chain — not this field's cycle
}

/**
 * Validate a would-be reference `value` for a `type` field on token `currentId`. Null when the value
 * is not a reference or is a valid one. Cycle is checked against the committed graph.
 */
export function validateReference(
  value: unknown,
  type: string,
  currentId: string,
  byPath: Map<string, Token>,
): ReferenceIssue | null {
  if (!dtcg.tokens.isReference(value)) return null;
  const path = dtcg.tokens.referenceToPath(value);
  const target = byPath.get(path);
  if (!target) return 'dangling';
  if (reachesToken(path, currentId, byPath)) return 'cycle';
  if (target.type !== type) return 'type-mismatch';
  return null;
}
