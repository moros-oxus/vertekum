import type { DtcgNode } from '../dtcg/parse';

/**
 * File-name conventions. The document is keyed by file name because that is what it holds — set and
 * resolver are both "a file", and the suffix is what tells them apart.
 */

export const RESOLVER_SUFFIX = '.resolver.json';

export function isResolverFile(name: string): boolean {
  return name.endsWith(RESOLVER_SUFFIX);
}

export function setFileName(set: string): string {
  return `${set}.json`;
}

export function setFromFileName(name: string): string {
  return name.replace(/\.json$/, '');
}

export function resolverFileName(name: string): string {
  return `${name}${RESOLVER_SUFFIX}`;
}

export function resolverFromFileName(name: string): string {
  return name.slice(0, -RESOLVER_SUFFIX.length);
}

/** Partition a file record into token sets and resolver documents. */
export function partition(files: Record<string, DtcgNode>): {
  sets: Record<string, DtcgNode>;
  resolvers: Record<string, DtcgNode>;
} {
  const sets: Record<string, DtcgNode> = {};
  const resolvers: Record<string, DtcgNode> = {};
  for (const [name, node] of Object.entries(files)) {
    if (isResolverFile(name)) resolvers[name] = node;
    else sets[name] = node;
  }
  return { sets, resolvers };
}
