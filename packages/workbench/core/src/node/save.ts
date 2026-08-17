import type { Document } from '../document/document';
import { type JsonIndent, readCollection, writeCollection } from './collection';

/**
 * Serialize a document and write it to a collection directory, returning the file names that
 * changed. Comparison is on serialized form, so a mutation that round-trips to identical bytes
 * reports nothing. `dryRun` computes the same answer and writes nothing.
 *
 * This is the single write path every client shares. A verb handler mutates the document and
 * returns; persistence happens here, once, afterwards — which is what stops a contributed command
 * from inventing its own way to touch the disk (ADR-0030 amendment).
 */
export async function saveDocument(
  document: Document,
  collectionDir: string,
  options: { dryRun?: boolean; indent?: JsonIndent } = {},
): Promise<string[]> {
  const next = document.getFiles();
  const current = await readCollection(collectionDir);

  const changed = Object.keys(next).filter(
    (name) => JSON.stringify(next[name]) !== JSON.stringify(current[name]),
  );
  const removed = Object.keys(current).filter((name) => !(name in next));

  if (!options.dryRun && (changed.length > 0 || removed.length > 0)) {
    await writeCollection(collectionDir, next, options.indent);
  }
  return [...changed, ...removed];
}
