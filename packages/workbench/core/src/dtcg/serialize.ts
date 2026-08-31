import { isGroupCodec, type TokenCodec } from '../document/codec';
import type { Token } from '../document/types';
import { type DtcgNode, VTK_PREFIX } from './parse';
import { cloneNode, setNodeAt } from './tree';

/** The lookup half of the codec service — all the write path needs. */
export interface CodecLookup {
  get(key: string): TokenCodec | undefined;
}

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
export function tokenNode(token: Token, codecs?: CodecLookup): DtcgNode {
  const extensions: DtcgNode = { ...(token.extensions ?? {}) };
  if (token.vtk) {
    for (const [sub, value] of Object.entries(token.vtk)) {
      extensions[`${VTK_PREFIX}.${sub}`] = value;
    }
  }

  // A codec-owned token writes as its CARRIER — a conformant empty group whose payload holds the
  // data (extension-held token data). Store form only: view builders (exporter staging) call
  // without a lookup and get the plain interchange node below. A codec key with no registered
  // codec also falls through to plain — better an honest token than an unreproducible payload.
  const codec =
    token.codec === undefined ? undefined : codecs?.get(token.codec);
  if (codec && !isGroupCodec(codec)) {
    extensions[codec.key] = codec.serialize(token);
    return { $extensions: extensions };
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

/**
 * The INTERCHANGE form of a collection: every codec token's carrier node replaced by its plain
 * `$type`/`$value` node, in a clone — the authored files are never touched. This is what exporters
 * receive (`runTargets`), so a tool that stages files verbatim (the terrazzo bridge) sees real
 * tokens where the store holds conformant carriers. Files without carriers pass through by
 * reference; with no codec tokens at all this is the identity.
 */
export function interchangeFiles(
  files: Record<string, DtcgNode>,
  tokens: Token[],
): Record<string, DtcgNode> {
  const carriers = tokens.filter((token) => token.codec !== undefined);
  if (carriers.length === 0) return files;

  const out: Record<string, DtcgNode> = { ...files };
  for (const token of carriers) {
    const name = `${token.set ?? DEFAULT_SET}.json`;
    const held = out[name];
    if (!held) continue;
    // Clone lazily, once per touched file.
    const tree = held === files[name] ? cloneNode(held) : held;
    out[name] = tree;
    setNodeAt(tree, token.path, tokenNode(token));
  }
  return out;
}
