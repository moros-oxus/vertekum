import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import type { DtcgNode } from '../dtcg/parse';

/** Read every `*.json` file in a collection directory as parsed JSON. */
export async function readCollection(
  dir: string,
): Promise<Record<string, DtcgNode>> {
  const entries = await readdir(dir).catch(() => [] as string[]);
  const files: Record<string, DtcgNode> = {};
  for (const name of entries) {
    if (!name.endsWith('.json')) continue;
    files[name] = JSON.parse(await readFile(join(dir, name), 'utf8'));
  }
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
    await writeFile(
      join(dir, name),
      `${JSON.stringify(data, null, indent)}\n`,
      'utf8',
    );
  }
  const existing = await readdir(dir).catch(() => [] as string[]);
  for (const name of existing) {
    if (name.endsWith('.json') && !(name in files)) {
      await unlink(join(dir, name)).catch(() => {});
    }
  }
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
