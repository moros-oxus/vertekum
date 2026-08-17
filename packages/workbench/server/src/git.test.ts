import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';
import { collectionAtRef, latestVersionTag, releaseAtHead } from './git';

const run = promisify(execFile);

async function repo() {
  const dir = await mkdtemp(join(tmpdir(), 'vtk-git-'));
  const g = (...args: string[]) => run('git', args, { cwd: dir });
  await g('init', '-q');
  await g('config', 'user.email', 't@example.com');
  await g('config', 'user.name', 'T');
  const tokens = join(dir, 'tokens');
  await mkdir(tokens, { recursive: true });
  return { dir, tokens, g };
}

test('latestVersionTag picks the highest v* tag, null when none', async () => {
  const { dir, tokens, g } = await repo();
  expect(await latestVersionTag(dir)).toBeNull();
  await writeFile(join(tokens, 'core.json'), '{}');
  await g('add', '.');
  await g('commit', '-qm', 'init');
  await g('tag', 'v0.1.0');
  await g('tag', 'v0.2.0');
  await g('tag', 'v0.10.0');
  expect(await latestVersionTag(dir)).toEqual({
    tag: 'v0.10.0',
    version: '0.10.0',
  });
});

test('collectionAtRef reads token files as they were at a tag', async () => {
  const { dir, tokens, g } = await repo();
  await writeFile(
    join(tokens, 'core.json'),
    JSON.stringify({ color: { a: { $type: 'color', $value: '#f00' } } }),
  );
  await g('add', '.');
  await g('commit', '-qm', 'v1');
  await g('tag', 'v1.0.0');
  await writeFile(
    join(tokens, 'core.json'),
    JSON.stringify({ color: { a: { $type: 'color', $value: '#0f0' } } }),
  );
  await g('add', '.');
  await g('commit', '-qm', 'wip');

  const files = await collectionAtRef(dir, tokens, 'v1.0.0');
  expect(files).toEqual({
    'core.json': { color: { a: { $type: 'color', $value: '#f00' } } },
  });
});

test('collectionAtRef excludes *.resolver.json (composition, not values)', async () => {
  const { dir, tokens, g } = await repo();
  await writeFile(
    join(tokens, 'core.json'),
    JSON.stringify({ color: { a: { $type: 'color', $value: '#f00' } } }),
  );
  await writeFile(
    join(tokens, 'acme.resolver.json'),
    JSON.stringify({ version: '2025.10' }),
  );
  await g('add', '.');
  await g('commit', '-qm', 'v1');
  await g('tag', 'v1.0.0');

  const files = await collectionAtRef(dir, tokens, 'v1.0.0');
  expect(Object.keys(files)).toEqual(['core.json']); // resolver file excluded
});

test('releaseAtHead commits and tags only when enabled', async () => {
  const { dir, tokens, g } = await repo();
  await writeFile(join(tokens, 'core.json'), '{}');
  await g('add', '.');
  await g('commit', '-qm', 'init');
  await writeFile(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'x', version: '0.0.0' }, null, 2),
  );
  await writeFile(join(dir, 'CHANGELOG.md'), '# Changelog\n');

  await releaseAtHead(dir, {
    projectDir: dir,
    collectionDir: tokens,
    changelogPath: 'CHANGELOG.md',
    version: '1.0.0',
    commit: { message: 'chore: release v1.0.0' },
    tag: true,
    bumpPackage: true,
  });

  const tags = (await g('tag', '--list')).stdout.trim().split('\n');
  expect(tags).toContain('v1.0.0');
  const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'));
  expect(pkg.version).toBe('1.0.0');
  const log = (await g('log', '--oneline')).stdout;
  expect(log).toContain('chore: release v1.0.0');
});
