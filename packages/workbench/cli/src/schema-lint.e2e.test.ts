import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';
import { bin, exampleFixture } from './e2e-fixture';

const run = promisify(execFile);

test('schema lint passes a sound tree', async () => {
  const cwd = await exampleFixture('vtk-slint-', 'schemas');
  const { stdout } = await run('node', [bin, 'schema', 'lint'], { cwd });
  expect(stdout).toContain('module(s) clean');
}, 60_000);

test('lint catches a broken fragment the build sweep never reaches', async () => {
  const cwd = await exampleFixture('vtk-slint-', 'schemas');
  await writeFile(
    join(cwd, 'schemas/fragments.dfn'),
    'tone = warm | <missing>\n',
  );

  // The coverage difference, demonstrated: build has nothing to say about a fragment…
  const build = await run('node', [bin, 'schema', 'build', '--dry-run'], {
    cwd,
  });
  expect(build.stdout).toContain('skipped');

  // …lint fails it, positioned and attributed.
  const lint = run('node', [bin, 'schema', 'lint'], { cwd });
  await expect(lint).rejects.toMatchObject({ code: 1 });
  const { stderr } = (await lint.catch((e) => e)) as { stderr: string };
  expect(stderr).toContain(
    "schemas/fragments.dfn:1:15 unknown production '<missing>'",
  );
}, 60_000);

test("a misplaced '*' reports the open-set hint, not a grammar complaint", async () => {
  const cwd = await exampleFixture('vtk-slint-', 'schemas');
  await writeFile(join(cwd, 'schemas/scale.dfn'), 'root = space.*\n');

  const lint = run('node', [bin, 'schema', 'lint'], { cwd });
  await expect(lint).rejects.toMatchObject({ code: 1 });
  const { stderr } = (await lint.catch((e) => e)) as { stderr: string };
  expect(stderr).toContain('schemas/scale.dfn:1:14');
  expect(stderr).toContain(
    "'*' marks a set open and sits inside the reference or group it opens — <name*> or [a | b *]",
  );
}, 60_000);

test('lint --json reports failure machine-readably', async () => {
  const cwd = await exampleFixture('vtk-slint-', 'schemas');
  await writeFile(join(cwd, 'schemas/scale.dfn'), 'root = space.*\n');

  const lint = run('node', [bin, 'schema', 'lint', '--json'], { cwd });
  await expect(lint).rejects.toMatchObject({ code: 1 });
  const { stdout } = (await lint.catch((e) => e)) as { stdout: string };
  const payload = JSON.parse(stdout);
  expect(payload.ok).toBe(false);
  expect(payload.command).toBe('schema lint');
  expect(payload.error).toContain('schemas/scale.dfn:1:14');
}, 60_000);

test('a directory argument sweeps it — dfns outside ./schemas lint in place', async () => {
  const cwd = await exampleFixture('vtk-slint-', 'schemas');
  const { mkdir } = await import('node:fs/promises');
  await mkdir(join(cwd, 'src/dfn'), { recursive: true });
  await writeFile(
    join(cwd, 'src/dfn/emphasis.dfn'),
    'emphasis = subtle | bold\n',
  );
  await writeFile(join(cwd, 'src/dfn/broken.dfn'), 'tone = warm | <missing>\n');

  const lint = run('node', [bin, 'schema', 'lint', 'src/dfn'], { cwd });
  await expect(lint).rejects.toMatchObject({ code: 1 });
  const { stderr } = (await lint.catch((e) => e)) as { stderr: string };
  expect(stderr).toContain(
    "src/dfn/broken.dfn:1:15 unknown production '<missing>'",
  );

  const missing = run('node', [bin, 'schema', 'lint', 'src/nowhere'], { cwd });
  await expect(missing).rejects.toMatchObject({ code: 1 });
  const bad = (await missing.catch((e) => e)) as { stderr: string };
  expect(bad.stderr).toContain('no such file or directory: src/nowhere');
}, 60_000);
