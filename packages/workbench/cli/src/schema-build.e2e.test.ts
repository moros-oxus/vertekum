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

test('the sweep skips fragment modules; naming one explicitly errors', async () => {
  const cwd = await exampleFixture('vtk-sbuild-', 'schemas');
  await writeFile(join(cwd, 'schemas/fragments.dfn'), 'tone = warm | cool\n');

  const { stdout } = await run('node', [bin, 'schema', 'build'], { cwd });
  expect(stdout).toContain('built 1 module(s)');
  expect(stdout).toContain(
    'fragments.dfn declares no root (a fragment) — skipped',
  );

  await expect(
    run('node', [bin, 'schema', 'build', 'schemas/fragments.dfn'], { cwd }),
  ).rejects.toMatchObject({ code: 1 });
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

test('configured source/out: builds mirror into out; lint sweeps source by default', async () => {
  const cwd = await exampleFixture('vtk-sbuild-', 'schemas');
  const { mkdir } = await import('node:fs/promises');
  await writeFile(
    join(cwd, 'vertekum.config.ts'),
    [
      "import { defineConfig } from '@vertekum/core';",
      "import { schemaBuilderExtension } from '@vertekum/schema-builder';",
      'export default defineConfig({',
      "  collection: './tokens',",
      "  extensions: [schemaBuilderExtension({ source: './src/dfn', out: './src/schemas' })],",
      '});',
      '',
    ].join('\n'),
  );
  await mkdir(join(cwd, 'src/dfn/brand'), { recursive: true });
  await writeFile(
    join(cwd, 'src/dfn/brand/color.dfn'),
    'root = color.[base | subtle]\n',
  );

  const built = await run('node', [bin, 'schema', 'build'], { cwd });
  expect(built.stdout).toContain('wrote src/schemas/brand/color.json');
  const artifact = await readFile(
    join(cwd, 'src/schemas/brand/color.json'),
    'utf8',
  );
  expect(artifact).toContain('src/dfn/brand/color.dfn');

  const check = await run('node', [bin, 'schema', 'build', '--check'], { cwd });
  expect(check.stdout).toContain('current');

  // lint's default sweep is the configured source, not ./schemas
  await writeFile(join(cwd, 'src/dfn/broken.dfn'), 'tone = warm | <missing>\n');
  const lint = run('node', [bin, 'schema', 'lint'], { cwd });
  await expect(lint).rejects.toMatchObject({ code: 1 });
  const { stderr } = (await lint.catch((e) => e)) as { stderr: string };
  expect(stderr).toContain('src/dfn/broken.dfn');
}, 60_000);

test('a positional [out] pairs with the invocation: directory mirrors, file lands directly', async () => {
  const cwd = await exampleFixture('vtk-sbuild-', 'schemas');
  const { mkdir } = await import('node:fs/promises');
  await mkdir(join(cwd, 'src/dfn/brand'), { recursive: true });
  await writeFile(join(cwd, 'src/dfn/brand/color.dfn'), 'root = color.base\n');

  const dir = await run(
    'node',
    [bin, 'schema', 'build', 'src/dfn', 'src/out'],
    { cwd },
  );
  expect(dir.stdout).toContain('wrote src/out/brand/color.json');

  const file = await run(
    'node',
    [bin, 'schema', 'build', 'src/dfn/brand/color.dfn', 'src/flat'],
    { cwd },
  );
  expect(file.stdout).toContain('wrote src/flat/color.json');
}, 60_000);
