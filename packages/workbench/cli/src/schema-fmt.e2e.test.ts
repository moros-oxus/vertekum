import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';
import { bin, exampleFixture } from './e2e-fixture';

const run = promisify(execFile);

test('schema fmt normalizes a scruffy block and is then a no-op', async () => {
  const cwd = await exampleFixture('vtk-sfmt-', 'schemas');
  const path = join(cwd, 'schemas/scruffy.dfn');
  await writeFile(
    path,
    ['deno = [', ' one', ' | two', ']', '', 'root = t.<deno>', ''].join('\n'),
  );

  const first = await run('node', [bin, 'schema', 'fmt'], { cwd });
  expect(first.stdout).toContain('formatted 1 module(s)');
  expect(await readFile(path, 'utf8')).toBe(
    ['deno = [', '  one', '  | two', ']', '', 'root = t.<deno>', ''].join('\n'),
  );

  const second = await run('node', [bin, 'schema', 'fmt'], { cwd });
  expect(second.stdout).toContain('already formatted');
}, 60_000);

test('fmt --check exits 1 naming the unformatted file; --dry-run writes nothing', async () => {
  const cwd = await exampleFixture('vtk-sfmt-', 'schemas');
  const path = join(cwd, 'schemas/scruffy.dfn');
  const scruffy = 'deno = a|b\nroot = t.<deno>\n';
  await writeFile(path, scruffy);

  const check = run('node', [bin, 'schema', 'fmt', '--check'], { cwd });
  await expect(check).rejects.toMatchObject({ code: 1 });
  const { stderr } = (await check.catch((e) => e)) as { stderr: string };
  expect(stderr).toContain('schemas/scruffy.dfn');

  const dry = await run('node', [bin, 'schema', 'fmt', '--dry-run'], { cwd });
  expect(dry.stdout).toContain('would write');
  expect(await readFile(path, 'utf8')).toBe(scruffy);
}, 60_000);

test('a module that does not lex is skipped with a notice, never rewritten', async () => {
  const cwd = await exampleFixture('vtk-sfmt-', 'schemas');
  const path = join(cwd, 'schemas/broken.dfn');
  const broken = 'deno = "unterminated\n';
  await writeFile(path, broken);

  const { stdout } = await run('node', [bin, 'schema', 'fmt'], { cwd });
  expect(stdout).toContain('does not lex');
  expect(await readFile(path, 'utf8')).toBe(broken);
}, 60_000);

test('lint --fix relocates a trailing star and reports the unfixable remainder', async () => {
  const cwd = await exampleFixture('vtk-sfmt-', 'schemas');
  await writeFile(
    join(cwd, 'schemas/mixed.dfn'),
    'roles = a | b\nopen = <roles>*\nbad = color.*\n',
  );

  const lint = run('node', [bin, 'schema', 'lint', '--fix'], { cwd });
  await expect(lint).rejects.toMatchObject({ code: 1 });
  const { stderr } = (await lint.catch((e) => e)) as { stderr: string };
  expect(stderr).toContain("moved '*' inside the reference");
  expect(stderr).toContain("'*' marks a set open");
  // A handler that throws writes nothing (runner contract), so with unfixables present
  // the fix stays un-persisted. The fixable-only path is what writes:
  await writeFile(
    join(cwd, 'schemas/mixed.dfn'),
    'roles = a | b\nopen = <roles>*\n',
  );
  const clean = await run('node', [bin, 'schema', 'lint', '--fix'], { cwd });
  expect(clean.stdout).toContain("moved '*' inside the reference");
  expect(await readFile(join(cwd, 'schemas/mixed.dfn'), 'utf8')).toBe(
    'roles = a | b\nopen = <roles*>\n',
  );
}, 60_000);
