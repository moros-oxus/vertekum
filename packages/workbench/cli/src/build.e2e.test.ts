import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
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
