import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, expect, test } from 'vitest';
import { createBridgeServer } from './server';

const sh = promisify(execFile);

let close: (() => void) | undefined;
afterEach(() => close?.());

async function start(collectionDir: string, projectDir: string) {
  const server = createBridgeServer(collectionDir, projectDir);
  await new Promise<void>((r) => server.listen(0, () => r()));
  close = () => server.close();
  const { port } = server.address() as AddressInfo;
  return `http://localhost:${port}`;
}

test('/api/file resolves against projectDir, /api/collection against collectionDir', async () => {
  const project = await mkdtemp(join(tmpdir(), 'vtk-proj-'));
  const collection = join(project, 'tokens');
  await mkdir(collection, { recursive: true });
  await writeFile(
    join(collection, 'core.json'),
    JSON.stringify({ color: { a: { $type: 'color', $value: '#f00' } } }),
  );
  const base = await start(collection, project);

  // /api/file writes under projectDir (NOT the collection)
  const put = await fetch(`${base}/api/file?path=.vertekum/release.lock.json`, {
    method: 'PUT',
    body: '{"version":"0.1.0"}',
  });
  expect(put.status).toBe(204);
  expect(
    await readFile(join(project, '.vertekum/release.lock.json'), 'utf8'),
  ).toBe('{"version":"0.1.0"}');

  // /api/collection still reads the collection dir
  const col = (await (await fetch(`${base}/api/collection`)).json()) as {
    files: Record<string, unknown>;
  };
  expect(col.files['core.json']).toBeDefined();

  // /api/settings writes under projectDir
  await fetch(`${base}/api/settings`, {
    method: 'PUT',
    body: JSON.stringify({ settings: { 'vtk.x': { on: true } } }),
  });
  expect(
    JSON.parse(
      await readFile(join(project, '.vertekum/settings.json'), 'utf8'),
    ),
  ).toEqual({ 'vtk.x': { on: true } });
});

test('/api/git reads latest tag + files-at-ref and cuts a release', async () => {
  const project = await mkdtemp(join(tmpdir(), 'vtk-gitsrv-'));
  const collection = join(project, 'tokens');
  await mkdir(collection, { recursive: true });
  const g = (...a: string[]) => sh('git', a, { cwd: project });
  await g('init', '-q');
  await g('config', 'user.email', 't@example.com');
  await g('config', 'user.name', 'T');
  await writeFile(
    join(collection, 'core.json'),
    JSON.stringify({ color: { a: { $type: 'color', $value: '#f00' } } }),
  );
  await g('add', '.');
  await g('commit', '-qm', 'init');
  await g('tag', 'v1.0.0');

  const base = await start(collection, project);

  const latest = await (await fetch(`${base}/api/git/latest-release`)).json();
  expect(latest).toEqual({ release: { tag: 'v1.0.0', version: '1.0.0' } });

  const atRef = (await (
    await fetch(`${base}/api/git/collection?ref=v1.0.0`)
  ).json()) as { files: Record<string, unknown> };
  expect(atRef.files['core.json']).toEqual({
    color: { a: { $type: 'color', $value: '#f00' } },
  });

  await writeFile(join(project, 'CHANGELOG.md'), '# Changelog\n');
  const cut = await fetch(`${base}/api/git/release`, {
    method: 'POST',
    body: JSON.stringify({
      version: '1.1.0',
      commit: { message: 'chore: release v1.1.0' },
      tag: true,
      bumpPackage: false,
      changelogPath: 'CHANGELOG.md',
    }),
  });
  expect(cut.status).toBe(204);
  const tags = (await g('tag', '--list')).stdout;
  expect(tags).toContain('v1.1.0');
});

test('/api/git/latest-release returns null release outside tags', async () => {
  const project = await mkdtemp(join(tmpdir(), 'vtk-gitsrv2-'));
  const collection = join(project, 'tokens');
  await mkdir(collection, { recursive: true });
  await sh('git', ['init', '-q'], { cwd: project });
  const base = await start(collection, project);
  const latest = await (await fetch(`${base}/api/git/latest-release`)).json();
  expect(latest).toEqual({ release: null });
});

test('PUT /api/collection dir-syncs: writes present files, deletes absent .json', async () => {
  const project = await mkdtemp(join(tmpdir(), 'vtk-dirsync-'));
  const collection = join(project, 'tokens');
  await mkdir(collection, { recursive: true });
  await writeFile(join(collection, 'old.json'), '{}');
  await writeFile(join(collection, 'keep.txt'), 'x'); // non-json, untouched
  const base = await start(collection, project);

  const put = await fetch(`${base}/api/collection`, {
    method: 'PUT',
    body: JSON.stringify({ files: { 'core.json': { color: {} } } }),
  });
  expect(put.status).toBe(204);
  const names = (await readdir(collection)).sort();
  expect(names).toEqual(['core.json', 'keep.txt']); // old.json deleted, keep.txt kept
});
