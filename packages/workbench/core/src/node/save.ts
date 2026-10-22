import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Document } from '../document/document';
import { type JsonIndent, readCollection, writeCollection } from './collection';

/**
 * Serialize a document and write it to a collection directory, returning the file names that
 * changed. Comparison is on serialized form, so a mutation that round-trips to identical bytes
 * reports nothing. `dryRun` computes the same answer and writes nothing.
 *
 * Only the changed files are written, each in its own source key order (its current text is the
 * template) — a command never rewrites a set it did not change, and never reorders one it did.
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
    const templates: Record<string, string> = {};
    for (const name of changed) {
      const text = await readFile(join(collectionDir, name), 'utf8').catch(
        () => undefined,
      );
      if (text !== undefined) templates[name] = text;
    }
    await writeCollection(collectionDir, next, options.indent, {
      only: changed,
      templates,
    });
  }
  return [...changed, ...removed];
}
