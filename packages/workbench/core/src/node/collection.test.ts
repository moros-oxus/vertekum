import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import {
  readCollection,
  readTextFile,
  writeCollection,
  writeTextFile,
} from './collection';

async function tempDir() {
  return mkdtemp(join(tmpdir(), 'vtk-collection-'));
}

describe('collection fs', () => {
  test('readCollection returns .json files as parsed objects', async () => {
    const dir = await tempDir();
    await writeFile(
      join(dir, 'core.json'),
      JSON.stringify({
        color: { primary: { $type: 'color', $value: '#f00' } },
      }),
    );

    const files = await readCollection(dir);

    expect(files['core.json']).toEqual({
      color: { primary: { $type: 'color', $value: '#f00' } },
    });
  });

  test('readCollection ignores non-json files', async () => {
    const dir = await tempDir();
    await writeFile(join(dir, 'README.md'), '# not json');

    expect(await readCollection(dir)).toEqual({});
  });

  test('readCollection on a missing directory returns empty', async () => {
    expect(
      await readCollection(join(tmpdir(), 'vtk-does-not-exist-xyz')),
    ).toEqual({});
  });

  test('writeCollection then readCollection round-trips', async () => {
    const dir = await tempDir();

    await writeCollection(dir, { 'tokens.json': { a: 1 } });

    expect(await readCollection(dir)).toEqual({ 'tokens.json': { a: 1 } });
  });

  test('writeCollection writes and dir-syncs *.resolver.json like any set file', async () => {
    const dir = await tempDir();
    await writeFile(join(dir, 'acme.resolver.json'), '{"version":"2025.10"}');

    // A record that keeps core.json but omits the resolver file deletes it (dir-sync).
    await writeCollection(dir, { 'core.json': { a: 1 } });
    expect(await readCollection(dir)).toEqual({ 'core.json': { a: 1 } });

    // A record that includes a resolver file writes it.
    await writeCollection(dir, {
      'core.json': { a: 1 },
      'beta.resolver.json': { version: '2025.10' },
    });
    expect(await readCollection(dir)).toEqual({
      'core.json': { a: 1 },
      'beta.resolver.json': { version: '2025.10' },
    });
  });

  test('writeTextFile writes text and creates parent directories', async () => {
    const dir = await tempDir();

    await writeTextFile(dir, 'build/tokens.css', ':root {}');

    expect(await readFile(join(dir, 'build/tokens.css'), 'utf8')).toBe(
      ':root {}',
    );
  });

  test('writeTextFile refuses to escape the collection directory', async () => {
    const dir = await tempDir();

    await expect(writeTextFile(dir, '../evil.css', 'x')).rejects.toThrow(
      /outside/,
    );
  });

  test('readTextFile returns file contents, or undefined when missing', async () => {
    const dir = await tempDir();
    await writeTextFile(dir, '.vertekum/settings.json', '{"a":1}');
    expect(await readTextFile(dir, '.vertekum/settings.json')).toBe('{"a":1}');
    expect(await readTextFile(dir, '.vertekum/missing.json')).toBeUndefined();
  });

  test('readTextFile refuses to escape the collection directory', async () => {
    const dir = await tempDir();
    await expect(readTextFile(dir, '../secret')).rejects.toThrow(/outside/);
  });
});

test('writeCollection defaults to two-space JSON and honours an override', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'vtk-indent-'));
  const files = { 'core.json': { color: { a: { $value: '#f00' } } } };
  const written = () => readFile(join(dir, 'core.json'), 'utf8');

  // Two spaces by default: a tool's output should not fight the repo's formatter.
  await writeCollection(dir, files);
  expect(await written()).toContain('\n  "color"');

  // A repo that formats differently aligns it through `format.indent` in its config.
  await writeCollection(dir, files, '\t');
  expect(await written()).toContain('\n\t"color"');
});

describe('nested collection directories', () => {
  test('readCollection walks subdirectories; keys are relative paths; dot-entries skipped', async () => {
    const dir = await tempDir();
    await mkdir(join(dir, 'brands/deep'), { recursive: true });
    await writeFile(join(dir, 'core.json'), '{}');
    await writeFile(join(dir, 'brands/brand-a.json'), '{}');
    await writeFile(join(dir, 'brands/deep/brand-b.json'), '{}');
    await mkdir(join(dir, '.hidden'));
    await writeFile(join(dir, '.hidden/nope.json'), '{}');

    expect(Object.keys(await readCollection(dir)).sort()).toEqual([
      'brands/brand-a.json',
      'brands/deep/brand-b.json',
      'core.json',
    ]);
  });

  test('writeCollection creates directories, dir-syncs recursively, removes emptied dirs', async () => {
    const dir = await tempDir();
    await writeCollection(dir, {
      'core.json': {},
      'brands/brand-a.json': { x: { $type: 'number', $value: 1 } },
    });
    expect(Object.keys(await readCollection(dir)).sort()).toEqual([
      'brands/brand-a.json',
      'core.json',
    ]);

    // The nested set leaves the record → its file goes, and the emptied directory with it.
    await writeCollection(dir, { 'core.json': {} });
    expect((await readdir(dir)).sort()).toEqual(['core.json']);
  });
});
