import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';
import { bin, exampleFixture } from './e2e-fixture';

const run = promisify(execFile);
const HOUSE = 'schemas/house.json';

test('schema build rebuilds a stamped file and --check agrees it is current', async () => {
  const cwd = await exampleFixture('vtk-sbuild-', 'schemas');
  const before = await readFile(join(cwd, HOUSE), 'utf8');

  const { stdout } = await run('node', [bin, 'schema', 'build'], { cwd });
  expect(stdout).toContain('built 1 module(s)');
  expect(await readFile(join(cwd, HOUSE), 'utf8')).toBe(before);

  const check = await run('node', [bin, 'schema', 'build', '--check'], { cwd });
  expect(check.stdout).toContain('current');
}, 60_000);

test('--check exits 1 when a built file is stale; --dry-run withholds the fix', async () => {
  const cwd = await exampleFixture('vtk-sbuild-', 'schemas');
  const path = join(cwd, HOUSE);
  const fresh = await readFile(path, 'utf8');
  await writeFile(path, fresh.replace('"success"', '"triumph"'));

  await expect(
    run('node', [bin, 'schema', 'build', '--check'], { cwd }),
  ).rejects.toMatchObject({ code: 1 });

  const dry = await run('node', [bin, 'schema', 'build', '--dry-run'], { cwd });
  expect(dry.stdout).toContain('would write');
  expect(await readFile(path, 'utf8')).toContain('triumph');

  await run('node', [bin, 'schema', 'build'], { cwd });
  expect(await readFile(path, 'utf8')).toBe(fresh);
}, 60_000);

test('a built file whose stamp was removed is never overwritten', async () => {
  const cwd = await exampleFixture('vtk-sbuild-', 'schemas');
  const path = join(cwd, HOUSE);
  const owned = (await readFile(path, 'utf8')).replace(/ *"\$comment".*\n/, '');
  await writeFile(path, owned);

  const { stdout } = await run('node', [bin, 'schema', 'build'], { cwd });
  expect(stdout).toContain('left as is');
  expect(await readFile(path, 'utf8')).toBe(owned);
}, 60_000);
