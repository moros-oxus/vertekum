import type { ResolverDocument } from '../document/resolver-types';
import type { Token } from '../document/types';
import type { DtcgNode } from '../dtcg/parse';
import { serializeResolver } from '../dtcg/resolver';
import { serializeSets } from '../dtcg/serialize';

/**
 * The raw file seam a StorageProvider reads/writes. Node fs and the browser fetch
 * client are thin adapters of this (ADR-0008, ADR-0015).
 */
export interface FileStore {
  readAll(): Promise<Record<string, DtcgNode>>;
  writeAll(files: Record<string, DtcgNode>): Promise<void>;
}

/**
 * Loads/saves the document's tokens + set list + resolver documents against a backing store
 * (ADR-0008). Set = file (`sets` = collection file names minus `.json`); resolver = a
 * `<name>.resolver.json` file, partitioned out of the token sets by its suffix.
 */
export interface StorageProvider {
  /** The parsed files, keyed by file name — what the document holds. */
  load(): Promise<Record<string, DtcgNode>>;
  save(files: Record<string, DtcgNode>): Promise<void>;
}

const RESOLVER_SUFFIX = '.resolver.json';

/**
 * The document as DTCG files: one per token set, plus one `<name>.resolver.json` per resolver
 * (set = file). The StorageProvider and the CLI both go through here, so a browser write and a CLI
 * write produce byte-identical output.
 */
export function serializeDocument(
  tokens: Token[],
  sets: string[],
  resolvers: Map<string, ResolverDocument> = new Map(),
): Record<string, DtcgNode> {
  const files = serializeSets(tokens, sets);
  for (const [name, doc] of resolvers) {
    files[`${name}${RESOLVER_SUFFIX}`] = serializeResolver(doc);
  }
  return files;
}

/**
 * The provider is now a thin pass-through: the document holds parsed files, so there is nothing to
 * translate in either direction. Parsing into tokens here is what used to discard everything a
 * `Token` could not represent.
 */
export function createStorageProvider(store: FileStore): StorageProvider {
  return {
    async load() {
      return store.readAll();
    },
    async save(files) {
      // The bridge dir-syncs the union, so a dropped set/resolver has its file deleted.
      await store.writeAll(files);
    },
  };
}
