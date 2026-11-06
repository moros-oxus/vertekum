import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';
import { bin, exampleFixture } from './e2e-fixture';

const run = promisify(execFile);
const fixture = () => exampleFixture('vtk-build-');

test('build writes the configured target to disk', async () => {
  const cwd = await fixture();
  const { stdout } = await run('node', [bin, 'build', '--json'], { cwd });
  const result = JSON.parse(stdout);
  expect(result.ok).toBe(true);
  expect(result.targets[0].id).toBe('web');
  const css = await readFile(join(cwd, 'build/css/tokens.css'), 'utf8');
  expect(css).toContain(':root');
}, 60_000);

test('build --dry-run writes nothing', async () => {
  const cwd = await fixture();
  await run('node', [bin, 'build', '--dry-run', '--json'], { cwd });
  await expect(
    readFile(join(cwd, 'build/css/tokens.css'), 'utf8'),
  ).rejects.toThrow();
}, 60_000);

test('build exits 2 on an unknown target id', async () => {
  const cwd = await fixture();
  await expect(
    run('node', [bin, 'build', '--target', 'ghost'], { cwd }),
  ).rejects.toMatchObject({ code: 2 });
}, 60_000);

test('build lists deprecations: --json carries them, text output counts them', async () => {
  const cwd = await fixture();
  const corePath = join(cwd, 'tokens/core.json');
  const core = JSON.parse(await readFile(corePath, 'utf8'));
  core.color.red.$deprecated = 'Use {color.gray}';
  core.color.gray['500'].$deprecated = true;
  await writeFile(corePath, JSON.stringify(core, null, 2));

  const { stdout } = await run('node', [bin, 'build', '--json'], { cwd });
  const result = JSON.parse(stdout);
  expect(result.deprecated).toEqual([
    { path: 'color.gray.500', set: 'core' },
    { path: 'color.red.100', set: 'core', message: 'Use {color.gray}' },
    { path: 'color.red.900', set: 'core', message: 'Use {color.gray}' },
  ]);

  const text = await run('node', [bin, 'build', '--dry-run'], { cwd });
  expect(text.stdout).toContain(
    '3 tokens deprecated — vertekum check lists their uses',
  );
}, 60_000);
