import {
  mkdtemp,
  readFile,
  rm,
  stat,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { restoreFiles } from '../document/commands';
import { createDocument } from '../document/document';
import { readCollection } from './collection';
import { saveDocument } from './save';

const dirs: string[] = [];
afterEach(async () => {
  for (const dir of dirs.splice(0))
    await rm(dir, { recursive: true, force: true });
});

const CORE = `{
  "motion": {
    "duration": {
      "050": {
        "$type": "number",
        "$value": 50
      },
      "100": {
        "$type": "number",
        "$value": 100
      }
    }
  }
}
`;
const THEME = `{
  "space": {
    "050": {
      "$type": "number",
      "$value": 2
    },
    "100": {
      "$type": "number",
      "$value": 4
    }
  }
}
`;

async function project() {
  const dir = await mkdtemp(join(tmpdir(), 'vtk-save-'));
  dirs.push(dir);
  await writeFile(join(dir, 'core.json'), CORE);
  await writeFile(join(dir, 'theme.json'), THEME);
  // Back-date both files, so an untouched one is provably not rewritten.
  const past = new Date('2020-01-01T00:00:00Z');
  await utimes(join(dir, 'core.json'), past, past);
  await utimes(join(dir, 'theme.json'), past, past);
  const document = createDocument();
  document.hydrate(await readCollection(dir));
  return { dir, document };
}

test('a save writes only the files that changed', async () => {
  const { dir, document } = await project();
  const theme = structuredClone(document.getFiles()['theme.json']) as {
    space: Record<string, { $value: number }>;
  };
  (theme.space['100'] as { $value: number }).$value = 8;
  document.apply(restoreFiles({ 'theme.json': theme }));

  expect(await saveDocument(document, dir)).toEqual(['theme.json']);
  const core = await stat(join(dir, 'core.json'));
  expect(core.mtime.getUTCFullYear()).toBe(2020);
  expect(await readFile(join(dir, 'core.json'), 'utf8')).toBe(CORE);
});

test('a changed file keeps its source key order — "050" stays before "100"', async () => {
  const { dir, document } = await project();
  const theme = structuredClone(document.getFiles()['theme.json']) as {
    space: Record<string, { $value: number }>;
  };
  (theme.space['100'] as { $value: number }).$value = 8;
  document.apply(restoreFiles({ 'theme.json': theme }));
  await saveDocument(document, dir);
  expect(await readFile(join(dir, 'theme.json'), 'utf8')).toBe(
    THEME.replace('"$value": 4', '"$value": 8'),
  );
});
