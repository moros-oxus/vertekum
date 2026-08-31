import {
  mkdir,
  readdir,
  readFile,
  rmdir,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import type { DtcgNode } from '../dtcg/parse';

/**
 * Read every `*.json` file in a collection directory as parsed JSON, RECURSIVELY — subdirectories
 * are purely organizational (a set's name is its collection-relative path minus `.json`:
 * `brands/rexall`). Keys are POSIX-relative paths regardless of platform. Dot-entries are skipped:
 * hidden directories are never part of a collection.
 */
export async function readCollection(
  dir: string,
): Promise<Record<string, DtcgNode>> {
  const files: Record<string, DtcgNode> = {};
  const walk = async (prefix: string): Promise<void> => {
    const entries = await readdir(join(dir, prefix), {
      withFileTypes: true,
    }).catch(() => []);
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(rel);
      } else if (entry.name.endsWith('.json')) {
        files[rel] = JSON.parse(await readFile(join(dir, rel), 'utf8'));
      }
    }
  };
  await walk('');
  return files;
}

/**
 * How generated JSON is indented. Two spaces by default because that is the JSON convention and what
 * most repo formatters produce — a tool's output should not fight the formatter the repo already
 * runs. A repo that formats differently sets `format.indent` in its config.
 */
export type JsonIndent = string | number;

export const DEFAULT_INDENT: JsonIndent = 2;

/**
 * Write each named file back to the collection directory as pretty JSON, then dir-sync: the
 * collection must match the record, so remove managed `*.json` no longer present (this is how a
 * removed set's file is deleted). Scope is strictly `.json` in this dir — non-json siblings and
 * files elsewhere (`.vertekum/`, changelog) are untouched.
 */
export async function writeCollection(
  dir: string,
  files: Record<string, unknown>,
  indent: JsonIndent = DEFAULT_INDENT,
): Promise<void> {
  await mkdir(dir, { recursive: true });
  for (const [name, data] of Object.entries(files)) {
    // Nested set names (`brands/rexall.json`) need their directories to exist.
    await mkdir(dirname(join(dir, name)), { recursive: true });
    await writeFile(
      join(dir, name),
      `${JSON.stringify(data, null, indent)}\n`,
      'utf8',
    );
  }
  // Dir-sync, recursively: managed `*.json` no longer in the record are removed wherever they
  // sit, and a directory the sync emptied is removed best-effort (organizational only — nothing
  // references a directory).
  const sweep = async (prefix: string): Promise<void> => {
    const entries = await readdir(join(dir, prefix), {
      withFileTypes: true,
    }).catch(() => []);
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await sweep(rel);
        await rmdir(join(dir, rel)).catch(() => {}); // only succeeds when emptied
      } else if (entry.name.endsWith('.json') && !(rel in files)) {
        await unlink(join(dir, rel)).catch(() => {});
      }
    }
  };
  await sweep('');
}

/** Write an export artifact as text, refusing to escape the collection directory. */
export async function writeTextFile(
  dir: string,
  relPath: string,
  content: string,
): Promise<void> {
  const root = resolve(dir);
  const target = resolve(root, relPath);
  if (target !== root && !target.startsWith(root + sep)) {
    throw new Error(`refusing to write outside the collection: ${relPath}`);
  }
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, 'utf8');
}

/** Read a text file within the collection, refusing to escape it; undefined if it doesn't exist. */
export async function readTextFile(
  dir: string,
  relPath: string,
): Promise<string | undefined> {
  const root = resolve(dir);
  const target = resolve(root, relPath);
  if (target !== root && !target.startsWith(root + sep)) {
    throw new Error(`refusing to read outside the collection: ${relPath}`);
  }
  return readFile(target, 'utf8').catch(() => undefined);
}
