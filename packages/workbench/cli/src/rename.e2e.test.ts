import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';
import { bin, exampleFixture } from './e2e-fixture';

const run = promisify(execFile);
const fixture = () => exampleFixture('vtk-rename-');

test('rename rewrites references on disk and leaves check clean', async () => {
  const cwd = await fixture();
  const { stdout } = await run(
    'node',
    [bin, 'token', 'rename', 'color.red.900', 'color.red.950', '--json'],
    { cwd },
  );
  expect(JSON.parse(stdout).ok).toBe(true);

  const light = await readFile(join(cwd, 'tokens/light.json'), 'utf8');
  expect(light).toContain('{color.red.950}');
  await run('node', [bin, 'check'], { cwd });
}, 60_000);

test('rename --dry-run changes nothing', async () => {
  const cwd = await fixture();
  const before = await readFile(join(cwd, 'tokens/core.json'), 'utf8');
  const { stdout } = await run(
    'node',
    [
      bin,
      'token',
      'rename',
      'color.red.900',
      'color.red.950',
      '--dry-run',
      '--json',
    ],
    { cwd },
  );
  expect(JSON.parse(stdout).files).toContain('core.json');
  expect(await readFile(join(cwd, 'tokens/core.json'), 'utf8')).toBe(before);
}, 60_000);

test('a group rename needs --allow-group', async () => {
  const cwd = await fixture();
  await expect(
    run('node', [bin, 'token', 'rename', 'color.red', 'color.danger'], { cwd }),
  ).rejects.toMatchObject({ code: 1 });

  await run(
    'node',
    [bin, 'token', 'rename', 'color.red', 'color.danger', '--allow-group'],
    { cwd },
  );
  const core = await readFile(join(cwd, 'tokens/core.json'), 'utf8');
  expect(core).toContain('danger');
}, 60_000);
