import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';
import { bin, exampleFixture } from './e2e-fixture';

const run = promisify(execFile);
const fixture = () => exampleFixture('vtk-check-');

/** Add a token whose alias points nowhere — the failure `build` must refuse to emit. */
async function breakAnAlias(cwd: string): Promise<void> {
  const file = join(cwd, 'tokens/core.json');
  const core = JSON.parse(await readFile(file, 'utf8'));
  core.broken = { $type: 'color', $value: '{does.not.exist}' };
  await writeFile(file, JSON.stringify(core, null, '\t'));
}

test('check passes on the example project', async () => {
  const cwd = await fixture();
  const { stdout } = await run('node', [bin, 'check', '--json'], { cwd });
  const result = JSON.parse(stdout);
  expect(result.ok).toBe(true);
  expect(result.errors).toBe(0);
}, 60_000);

test('check reports a dangling alias and exits 1', async () => {
  const cwd = await fixture();
  await breakAnAlias(cwd);
  await expect(
    run('node', [bin, 'check', '--json'], { cwd }),
  ).rejects.toMatchObject({ code: 1 });
}, 60_000);

test('build refuses to run when check finds errors', async () => {
  const cwd = await fixture();
  await breakAnAlias(cwd);

  await expect(run('node', [bin, 'build'], { cwd })).rejects.toMatchObject({
    code: 1,
  });
  await expect(
    readFile(join(cwd, 'build/css/tokens.css'), 'utf8'),
  ).rejects.toThrow();

  const { stdout } = await run('node', [bin, 'build', '--no-check', '--json'], {
    cwd,
  });
  expect(JSON.parse(stdout).ok).toBe(true);
}, 60_000);

test('check reports a mistyped $ key, which parsing alone would swallow', async () => {
  const cwd = await fixture();
  const file = join(cwd, 'tokens/core.json');
  const core = JSON.parse(await readFile(file, 'utf8'));
  // `$vaule` is the class of mistake the parser silently drops: no $value means no token, and
  // every downstream validator inspects a model the evidence never reached.
  core.typo = { $type: 'color', $vaule: '#ff0000' };
  await writeFile(file, JSON.stringify(core, null, '\t'));

  const error = await run('node', [bin, 'check', '--json'], { cwd }).catch(
    (e) => e,
  );
  expect(error.code).toBe(1);

  const result = JSON.parse(error.stdout);
  expect(result.ok).toBe(false);
  const diagnostic = result.diagnostics.find((d: { pointer?: string }) =>
    d.pointer?.includes('typo'),
  );
  expect(diagnostic.code).toBe('schema/additionalProperties');
  expect(diagnostic.file).toBe('core.json');
  expect(diagnostic.message).toContain('$vaule');
}, 60_000);

test('a RELATIVE --cwd loads the config — the Tamblyn field report', async () => {
  // Run from the fixture's PARENT and point --cwd at it relatively: the discovered config path
  // must be absolutized before import, or Node parses it as a package name
  // (ERR_INVALID_MODULE_SPECIFIER).
  const fixtureDir = await fixture();
  const { stdout } = await run(
    'node',
    [bin, 'check', '--json', '--cwd', basename(fixtureDir)],
    { cwd: dirname(fixtureDir) },
  );
  expect(JSON.parse(stdout).ok).toBe(true);
}, 60_000);
