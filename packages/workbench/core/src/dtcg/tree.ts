import type { DtcgNode } from './parse';

/**
 * Reading and writing nodes in a raw DTCG tree.
 *
 * The document holds parsed files untransformed, so mutation is tree surgery rather than map
 * assignment. Keeping it here — pure, path-addressed, and tested on its own — keeps the document's
 * command reducer readable.
 */

/** A node is a token when it carries `$value`; everything else is a group. */
export function isTokenNode(node: DtcgNode): boolean {
  return '$value' in node;
}

export function getNodeAt(
  tree: DtcgNode,
  path: string[],
): DtcgNode | undefined {
  let cursor: DtcgNode = tree;
  for (const key of path) {
    const next = cursor[key];
    if (!next || typeof next !== 'object') return undefined;
    cursor = next as DtcgNode;
  }
  return cursor;
}

/** Write a node at `path`, creating intermediate groups. Existing groups are not disturbed. */
export function setNodeAt(
  tree: DtcgNode,
  path: string[],
  node: DtcgNode,
): void {
  const leaf = path.at(-1);
  if (leaf === undefined) return;

  let cursor: DtcgNode = tree;
  for (const key of path.slice(0, -1)) {
    const next = cursor[key];
    if (next && typeof next === 'object') {
      cursor = next as DtcgNode;
    } else {
      const created: DtcgNode = {};
      cursor[key] = created;
      cursor = created;
    }
  }
  cursor[leaf] = node;
}

/**
 * Delete the node at `path`.
 *
 * Ancestor groups are deliberately NOT pruned. A group may carry `$type`, `$description`, or a
 * pattern in `$extensions` — removing the last token beneath it would then discard a declaration
 * the author wrote, which is exactly the class of loss this model exists to prevent.
 */
export function deleteNodeAt(tree: DtcgNode, path: string[]): void {
  const leaf = path.at(-1);
  if (leaf === undefined) return;
  const parent = getNodeAt(tree, path.slice(0, -1));
  if (parent) delete parent[leaf];
}

/**
 * Remove ancestors of `path` that the mutation just left completely empty, stopping at the first
 * one that still holds something. Never touches the root.
 *
 * Groups are NOT pruned merely for having no tokens — a group can carry `$type`, `$description`, or
 * a pattern in `$extensions`, and discarding those is the loss this model exists to prevent. An
 * ancestor that is now `{}` holds nothing at all, so removing it is lossless, and leaving it behind
 * is worse than lossless: under a closed vocabulary a stranded empty group is an illegal name that
 * no verb can clear.
 */
export function pruneEmptyAncestors(tree: DtcgNode, path: string[]): void {
  for (let depth = path.length - 1; depth > 0; depth--) {
    const ancestor = path.slice(0, depth);
    const node = getNodeAt(tree, ancestor);
    if (!node || Object.keys(node).length > 0) return;
    deleteNodeAt(tree, ancestor);
  }
}

/** A structural clone, used to snapshot a file before mutating it so undo can restore it. */
export function cloneNode(node: DtcgNode): DtcgNode {
  return structuredClone(node);
}
