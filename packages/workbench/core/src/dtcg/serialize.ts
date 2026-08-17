import type { Token } from '../document/types';
import { type DtcgNode, VTK_PREFIX } from './parse';

/**
 * Build a nested DTCG tree from a flat `Token[]`, writing `org.vertekum.meta` under `$extensions`
 * (ADR-0020) and preserving foreign vendor extensions.
 *
 * This is NOT the document's write path — the document holds raw files and writes them directly.
 * It is a view builder for exporters that need a DTCG document from a *resolved* token list, which
 * is how the terrazzo bridge feeds its parser.
 */
/**
 * The DTCG node for one token. Extracted so the document's write path and this view builder share
 * one definition of what a token looks like on disk — two copies would drift.
 */
export function tokenNode(token: Token): DtcgNode {
  const extensions: DtcgNode = { ...(token.extensions ?? {}) };
  if (token.vtk) {
    for (const [sub, value] of Object.entries(token.vtk)) {
      extensions[`${VTK_PREFIX}.${sub}`] = value;
    }
  }

  return {
    // An untyped token carries `''` (no own `$type`, no ancestor group declaring one). Writing
    // `$type: ""` would invent a type that was never in the source, so omit the key entirely.
    ...(token.type !== '' ? { $type: token.type } : {}),
    // The AUTHORED notation, never the materialized copy: `$ref` for a pointer token ($value XOR
    // $ref), `sourceValue` when the value carries pointer objects.
    ...(token.ref !== undefined
      ? { $ref: token.ref }
      : { $value: token.sourceValue ?? token.value }),
    ...(token.description !== undefined
      ? { $description: token.description }
      : {}),
    // Omit `$extensions` when empty — writing `{}` onto every token is noise the author never wrote.
    ...(Object.keys(extensions).length > 0 ? { $extensions: extensions } : {}),
  };
}

export function serializeCollection(tokens: Token[]): DtcgNode {
  const root: DtcgNode = {};

  for (const token of tokens) {
    const leafKey = token.path.at(-1);
    if (leafKey === undefined) continue;

    let cursor = root;
    for (const key of token.path.slice(0, -1)) {
      const next = cursor[key];
      if (next && typeof next === 'object') {
        cursor = next as DtcgNode;
      } else {
        const created: DtcgNode = {};
        cursor[key] = created;
        cursor = created;
      }
    }

    cursor[leafKey] = tokenNode(token);
  }

  return root;
}

/** The set new/unset tokens land in when they have no `set` (set = file). */
export const DEFAULT_SET = 'tokens';

/**
 * Serialize tokens into a multi-file record (set = file): group by `token.set` (falling back to
 * `DEFAULT_SET`) and build one DTCG tree per set via `serializeCollection`, keyed `${set}.json`.
 */
export function serializeSets(
  tokens: Token[],
  sets?: string[],
): Record<string, DtcgNode> {
  const bySet = new Map<string, Token[]>();
  // Seed a bucket for each authoritative set name, so an empty set emits an empty `{}` file.
  for (const name of sets ?? []) {
    if (!bySet.has(name)) bySet.set(name, []);
  }
  for (const token of tokens) {
    const set = token.set ?? DEFAULT_SET;
    let group = bySet.get(set);
    if (!group) {
      group = [];
      bySet.set(set, group);
    }
    group.push(token);
  }
  const files: Record<string, DtcgNode> = {};
  for (const [set, group] of bySet) {
    files[`${set}.json`] = serializeCollection(group);
  }
  return files;
}
