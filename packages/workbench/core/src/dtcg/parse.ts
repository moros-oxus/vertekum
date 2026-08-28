import type { TokenCodec } from '../document/codec';
import { tokenId } from '../document/identity';
import type { Token } from '../document/types';
import { materializeTokens } from './materialize';

/**
 * Reverse-DNS root for Vertekum's own `$extensions` keys (ADR-0020). Concerns are split by sub-key,
 * where the sub-key names the premise of the data it holds — `org.vertekum.meta` for per-token
 * metadata. Only *active* sub-keys are recognized (see `VTK_ACTIVE_SUBS`); any inactive or unknown
 * `org.vertekum.*` key is ignored on parse and preserved on write.
 *
 * `org.vertekum.ident` was retired: identity is now `(set, path)` and nothing is stored on disk.
 * An ident already in a file falls through as an unrecognized sub-key — inert, and untouched.
 */
export const VTK_PREFIX = 'org.vertekum';

/**
 * DTCG 2025.10 §6.2 reserves `$root` as a TOKEN NAME (not a property) for a group's base value,
 * letting a group carry a value while still holding variants — `color.text` alongside
 * `color.text.subtle`. It is the one `$`-prefixed key that is a child rather than metadata, and it
 * is included in the path: `{color.text.$root}` resolves, `{color.text}` does not.
 *
 * Without it a real design system cannot be transcribed. Atlassian's vocabulary has 162 names that
 * are simultaneously a token and an ancestor, and DTCG requires tools to reject that shape.
 */
export const ROOT_TOKEN = '$root';

/**
 * A token's path as it should APPEAR outside the document, with `$root` removed.
 *
 * `$root` is an encoding detail, not a name. It exists because DTCG forbids a node that is both a
 * token and a group, and what it names is the group's OWN value — so the name an exporter should
 * emit is the group's: `color.text.$root` exports as `color.text`, which is what the design system
 * called it before DTCG needed the distinction. Leaking `$root` into a CSS custom property would
 * publish our storage format as someone's API.
 */
export function exportPath(path: string[]): string[] {
  return path.at(-1) === ROOT_TOKEN ? path.slice(0, -1) : path;
}

export type DtcgNode = Record<string, unknown>;

function isTokenNode(node: DtcgNode): boolean {
  return '$value' in node || typeof node.$ref === 'string';
}

/** Return `$extensions` without any Vertekum (`org.vertekum.*`) keys — foreign vendor data only. */
function foreignExtensions(ext: unknown): DtcgNode | undefined {
  if (!ext || typeof ext !== 'object') return undefined;
  const rest: DtcgNode = {};
  for (const [key, value] of Object.entries(ext as DtcgNode)) {
    if (!key.startsWith(`${VTK_PREFIX}.`)) rest[key] = value;
  }
  return Object.keys(rest).length > 0 ? rest : undefined;
}

/** Active vtk-bucket sub-keys the system recognizes; any other `org.vertekum.*` key is ignored. */
const VTK_ACTIVE_SUBS = new Set(['meta']);

/** Collect the active `org.vertekum.<sub>` keys into a bucket (ident → id; unknown/inactive ignored). */
function vtkBucket(ext: DtcgNode | undefined): DtcgNode | undefined {
  if (!ext) return undefined;
  const prefix = `${VTK_PREFIX}.`;
  const bucket: DtcgNode = {};
  for (const [key, value] of Object.entries(ext)) {
    if (!key.startsWith(prefix)) continue;
    const sub = key.slice(prefix.length);
    if (!VTK_ACTIVE_SUBS.has(sub)) continue; // ident (→ id), themes (retired), unknown — all ignored
    bucket[sub] = value;
  }
  return Object.keys(bucket).length > 0 ? bucket : undefined;
}

/**
 * DTCG lets a GROUP declare `$type` on behalf of every descendant that does not declare its own,
 * and that is the more common authoring style. `inherited` carries the nearest ancestor group's
 * type down; a token's own `$type` always wins.
 */
/**
 * The carrier rule (extension-held token data): a node that is not a token, has no non-`$`
 * children and no `$root`, and whose `$extensions` carries exactly ONE registered codec key,
 * materializes into an ordinary token via that codec. Anything else — children present, `$value`
 * beside the key, two registered keys — is left as authored: the payload is inert group data
 * there, and the malformed-carrier diagnostic belongs to the owning extension's schema binding,
 * which can say WHY, not to a silent parse rule.
 */
function carrierOf(
  node: DtcgNode,
  codecs: TokenCodec[],
): { codec: TokenCodec; payload: unknown } | null {
  const ext = node.$extensions;
  if (!ext || typeof ext !== 'object') return null;
  for (const key of Object.keys(node)) {
    if (!key.startsWith('$')) return null;
  }
  if (ROOT_TOKEN in node) return null;
  const matches = codecs.filter((codec) => codec.key in (ext as DtcgNode));
  if (matches.length !== 1) return null;
  const codec = matches[0] as TokenCodec;
  return { codec, payload: (ext as DtcgNode)[codec.key] };
}

function walk(
  node: DtcgNode,
  path: string[],
  out: Token[],
  set: string,
  codecs: TokenCodec[],
  inherited?: string,
): void {
  if (isTokenNode(node)) {
    const ext = node.$extensions as DtcgNode | undefined;
    const own = typeof node.$type === 'string' ? node.$type : undefined;
    const token: Token = {
      id: tokenId(set, path),
      path,
      type: own ?? inherited ?? '',
      value: node.$value,
      set,
    };
    // $value XOR $ref (enforced by the format binding) — $value wins on a malformed node.
    if (!('$value' in node) && typeof node.$ref === 'string') {
      token.ref = node.$ref;
    }
    if (typeof node.$description === 'string') {
      token.description = node.$description;
    }
    const vtk = vtkBucket(ext);
    if (vtk) token.vtk = vtk;
    const foreign = foreignExtensions(ext);
    if (foreign) token.extensions = foreign;
    out.push(token);
    return;
  }

  // A carrier node — conformant empty group on disk, ordinary token in the model. The codec's
  // fields are authoritative (the payload owns `$type`/`$value`/`$description`); the carrier's
  // OTHER extension keys ride exactly as they would on a real token.
  const carrier = path.length > 0 ? carrierOf(node, codecs) : null;
  if (carrier) {
    const fields = carrier.codec.materialize(carrier.payload, { set, path });
    if (fields) {
      const ext = node.$extensions as DtcgNode;
      const token: Token = {
        id: tokenId(set, path),
        path,
        type: fields.type,
        value: fields.value,
        set,
        codec: carrier.codec.key,
        codecSource: carrier.payload,
      };
      if (fields.description !== undefined) {
        token.description = fields.description;
      }
      const vtk = vtkBucket(ext);
      if (vtk) token.vtk = vtk;
      const foreign = foreignExtensions(ext);
      if (foreign) {
        delete foreign[carrier.codec.key];
        if (Object.keys(foreign).length > 0) token.extensions = foreign;
      }
      out.push(token);
      return;
    }
  }

  const groupType = typeof node.$type === 'string' ? node.$type : inherited;

  // The root token is a CHILD, so it is walked like one — which gives it `$type` inheritance and
  // its own `$description`/`$extensions` handling for free, rather than a second parsing path.
  const root = node[ROOT_TOKEN];
  if (root && typeof root === 'object') {
    walk(root as DtcgNode, [...path, ROOT_TOKEN], out, set, codecs, groupType);
  }

  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith('$')) continue;
    if (child && typeof child === 'object') {
      walk(child as DtcgNode, [...path, key], out, set, codecs, groupType);
    }
  }
}

/**
 * Parse a collection of DTCG files into a flat list of normalized tokens, each stamped with its set
 * (the file's name minus `.json`).
 *
 * Pointer references materialize against the whole collection MERGED — the flat document. The
 * resolver spec scopes reference resolution to the flattened structure, so under a composition the
 * exporter/validator path re-materializes each bundle (`resolveExporterInput`); the flat pass here
 * is what the un-composed model (UI, verbs, migrate) reads.
 */
export function parseCollection(
  files: Record<string, DtcgNode>,
  codecs: TokenCodec[] = [],
): Token[] {
  const out: Token[] = [];
  for (const [filename, node] of Object.entries(files)) {
    walk(node, [], out, filename.replace(/\.json$/, ''), codecs);
  }
  return materializeTokens(out);
}
