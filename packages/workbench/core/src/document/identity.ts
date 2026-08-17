/**
 * A token's identity is WHERE IT IS: which file, which path. Nothing is stored on disk.
 *
 * The previous model minted a hash of the path into `org.vertekum.ident`. That hash was not unique
 * across sets, so two sets overriding one path collided in the document's id-keyed map and one was
 * silently discarded — the exact shape a themed collection has. It also made a hand-authored file
 * second-class, which is backwards when files are the API.
 *
 * A set name is a file name minus its extension and never contains ':'; a path segment never
 * contains '.' (DTCG reserves it as the separator). So the first ':' splits unambiguously.
 */
const SEPARATOR = ':';

export function tokenId(set: string, path: string[]): string {
  return `${set}${SEPARATOR}${path.join('.')}`;
}

export function parseTokenId(id: string): { set: string; path: string[] } {
  const at = id.indexOf(SEPARATOR);
  if (at < 0) throw new Error(`malformed token id: '${id}'`);
  return { set: id.slice(0, at), path: id.slice(at + 1).split('.') };
}
