import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { runEject } from './eject';

async function fixture(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'vtk-eject-'));
  await mkdir(join(dir, 'src'), { recursive: true });
  return dir;
}

test('eject copies a schema and prints a config entry', async () => {
  const dir = await fixture();
  await writeFile(join(dir, 'src', 'thing.json'), '{"$id":"test:thing"}\n');

  const lines: string[] = [];
  const code = await runEject({
    source: './src/thing.json',
    projectDir: dir,
    write: (line) => lines.push(line),
  });

  expect(code).toBe(0);
  expect(
    JSON.parse(await readFile(join(dir, 'schemas', 'thing.json'), 'utf8')),
  ).toEqual({ $id: 'test:thing' });

  const printed = lines.join('\n');
  expect(printed).toContain("from: './schemas'");
  expect(printed).toContain("'thing.json'");
});

test('eject copies bytes verbatim rather than reformatting', async () => {
  const dir = await fixture();
  // An ejected schema should be the file that was shipped, not our reserialization of it.
  const original = '{\n\t"$id": "test:odd",\n\t"type":   "object"\n}\n';
  await writeFile(join(dir, 'src', 'odd.json'), original);

  await runEject({
    source: './src/odd.json',
    projectDir: dir,
    write: () => {},
  });

  expect(await readFile(join(dir, 'schemas', 'odd.json'), 'utf8')).toBe(
    original,
  );
});

test('eject refuses to overwrite without --force', async () => {
  const dir = await fixture();
  await mkdir(join(dir, 'schemas'), { recursive: true });
  await writeFile(join(dir, 'src', 'thing.json'), '{}\n');
  await writeFile(join(dir, 'schemas', 'thing.json'), '{"mine":true}\n');

  const lines: string[] = [];
  const code = await runEject({
    source: './src/thing.json',
    projectDir: dir,
    write: (line) => lines.push(line),
  });

  expect(code).toBe(1);
  // The author's edits are the entire point of ejecting; clobbering them silently is the one
  // unrecoverable thing this command could do.
  expect(await readFile(join(dir, 'schemas', 'thing.json'), 'utf8')).toContain(
    'mine',
  );
  expect(lines.join('\n')).toContain('--force');
});

test('--force overwrites', async () => {
  const dir = await fixture();
  await mkdir(join(dir, 'schemas'), { recursive: true });
  await writeFile(join(dir, 'src', 'thing.json'), '{"new":true}\n');
  await writeFile(join(dir, 'schemas', 'thing.json'), '{"mine":true}\n');

  const code = await runEject({
    source: './src/thing.json',
    projectDir: dir,
    force: true,
    write: () => {},
  });

  expect(code).toBe(0);
  expect(await readFile(join(dir, 'schemas', 'thing.json'), 'utf8')).toContain(
    'new',
  );
});

test('a source that does not resolve is an error, not a crash', async () => {
  const dir = await fixture();
  const lines: string[] = [];
  const code = await runEject({
    source: '@nope/not-installed/x.json',
    projectDir: dir,
    write: (line) => lines.push(line),
  });

  expect(code).toBe(1);
  expect(lines.join('\n')).toContain('@nope/not-installed/x.json');
});

test('an explicit destination is honoured', async () => {
  const dir = await fixture();
  await writeFile(join(dir, 'src', 'thing.json'), '{}\n');

  const lines: string[] = [];
  await runEject({
    source: './src/thing.json',
    dest: './vocab/renamed.json',
    projectDir: dir,
    write: (line) => lines.push(line),
  });

  expect(await readFile(join(dir, 'vocab', 'renamed.json'), 'utf8')).toBe(
    '{}\n',
  );
  expect(lines.join('\n')).toContain("from: './vocab'");
  expect(lines.join('\n')).toContain("'renamed.json'");
});
