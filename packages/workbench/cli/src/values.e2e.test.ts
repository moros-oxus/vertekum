import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';
import { bin, exampleFixture } from './e2e-fixture';

const run = promisify(execFile);

test('a colour short form stores the spec object, in the configured space', async () => {
  const cwd = await exampleFixture('vtk-values-');

  // default space: oklch
  await run(
    'node',
    [bin, 'token', 'add', 'color.gray.310', '#d1d5db', '--set', 'core'],
    { cwd },
  );
  const core = JSON.parse(
    await readFile(join(cwd, 'tokens/core.json'), 'utf8'),
  );
  const stored = core.color.gray['310'].$value;
  expect(stored.colorSpace).toBe('oklch');
  expect(stored.hex).toBe('#d1d5db');
  expect(stored.alpha).toBe(1);
  expect(stored.components).toHaveLength(3);

  // and the write satisfies the base binding
  const { stdout } = await run('node', [bin, 'check', '--json'], { cwd });
  expect(JSON.parse(stdout).ok).toBe(true);
}, 60_000);

test('defaultColorSpace in config changes what gets written', async () => {
  const cwd = await exampleFixture('vtk-values-');
  const configPath = join(cwd, 'vertekum.config.ts');
  const config = await readFile(configPath, 'utf8');
  await writeFile(
    configPath,
    config.replace(
      "collection: './tokens',",
      "collection: './tokens',\n  defaultColorSpace: 'srgb',",
    ),
  );

  await run(
    'node',
    [bin, 'token', 'add', 'color.gray.310', '#ff0000', '--set', 'core'],
    { cwd },
  );
  const core = JSON.parse(
    await readFile(join(cwd, 'tokens/core.json'), 'utf8'),
  );
  expect(core.color.gray['310'].$value).toEqual({
    colorSpace: 'srgb',
    components: [1, 0, 0],
    alpha: 1,
    hex: '#ff0000',
  });
}, 60_000);

test('unparseable input for a transforming type is a verb error naming accepted forms', async () => {
  const cwd = await exampleFixture('vtk-values-');
  const error = await run(
    'node',
    [bin, 'token', 'add', 'color.gray.310', 'blue-ish', '--set', 'core'],
    { cwd },
  ).catch((e) => e);

  expect(error.code).toBe(1);
  expect(error.stderr).toContain('is not a valid color value');
  expect(error.stderr).toContain('hex');

  // nothing was written
  const core = JSON.parse(
    await readFile(join(cwd, 'tokens/core.json'), 'utf8'),
  );
  expect(core.color.gray['310']).toBeUndefined();
}, 60_000);

test('references pass through the transform untouched', async () => {
  const cwd = await exampleFixture('vtk-values-');
  await run(
    'node',
    [
      bin,
      'token',
      'add',
      'color.gray.310',
      '{color.gray.900}',
      '--set',
      'core',
    ],
    { cwd },
  );
  const core = JSON.parse(
    await readFile(join(cwd, 'tokens/core.json'), 'utf8'),
  );
  expect(core.color.gray['310'].$value).toBe('{color.gray.900}');
}, 60_000);

test('the migrated corpus: migrate is idempotent, and build emits oklch', async () => {
  const cwd = await exampleFixture('vtk-values-');

  // the examples migrated when this arc landed — nothing left to convert
  const { stdout } = await run(
    'node',
    [bin, 'migrate', 'values', '--dry-run'],
    { cwd },
  );
  expect(stdout).toContain('would convert 0');

  await run('node', [bin, 'build'], { cwd });
  const css = await readFile(join(cwd, 'build/css/tokens.css'), 'utf8').catch(
    async () => {
      // the fixture's target writes wherever its config says; find the file
      const { readdir } = await import('node:fs/promises');
      const dir = join(cwd, 'build/css');
      const [file] = await readdir(dir);
      return readFile(join(dir, String(file)), 'utf8');
    },
  );
  expect(css).toContain('oklch(');
  expect(css).not.toContain('[object Object]');
}, 60_000);
