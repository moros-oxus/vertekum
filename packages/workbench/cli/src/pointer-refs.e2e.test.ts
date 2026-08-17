import { execFile } from 'node:child_process';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';
import { bin, exampleFixture } from './e2e-fixture';

const run = promisify(execFile);

const PTR_TOKENS = {
  base: {
    $type: 'color',
    $value: { colorSpace: 'oklch', components: [0.7, 0.32, 328], alpha: 1 },
  },
  alias: { $ref: '#/ptr/base' },
  hue: { $ref: '#/ptr/base/$value/components/2', $type: 'number' },
  wrapped: { $type: 'color', $value: { $ref: '#/ptr/base/$value' } },
};

/** Merge the pointer tokens into `core.json` — the set the example's resolver composes. */
async function seedPointerTokens(cwd: string, tokens: unknown): Promise<void> {
  const path = join(cwd, 'tokens/core.json');
  const core = JSON.parse(await readFile(path, 'utf8'));
  await writeFile(path, JSON.stringify({ ...core, ptr: tokens }));
}

async function cssOutput(cwd: string): Promise<string> {
  const dir = join(cwd, 'build/css');
  const [file] = await readdir(dir);
  return readFile(join(dir, String(file)), 'utf8');
}

test('a set using all three pointer forms: check green, build emits literals', async () => {
  const cwd = await exampleFixture('vtk-ptr-');
  await seedPointerTokens(cwd, PTR_TOKENS);

  const { stdout } = await run('node', [bin, 'check', '--json'], { cwd });
  expect(JSON.parse(stdout).ok).toBe(true);

  await run('node', [bin, 'build'], { cwd });
  const css = await cssOutput(cwd);
  expect(css).toContain('oklch(0.7 0.32 328)'); // base, alias and wrapped all render the colour
  expect(css).not.toContain('[object Object]');
  expect(css).not.toContain('undefined');
}, 60_000);

test('a dangling pointer fails check with token/dangling-pointer', async () => {
  const cwd = await exampleFixture('vtk-ptr-');
  await seedPointerTokens(cwd, { broken: { $ref: '#/nope' } });

  const error = await run('node', [bin, 'check', '--json'], { cwd }).catch(
    (e) => e,
  );
  expect(error.code).toBe(1);
  const report = JSON.parse(error.stdout);
  expect(report.ok).toBe(false);
  expect(
    report.diagnostics.some(
      (d: { code: string }) => d.code === 'token/dangling-pointer',
    ),
  ).toBe(true);
}, 60_000);

test('token rename rewrites pointers end-to-end', async () => {
  const cwd = await exampleFixture('vtk-ptr-');
  await seedPointerTokens(cwd, PTR_TOKENS);

  await run('node', [bin, 'token', 'rename', 'ptr.base', 'ptr.ground'], {
    cwd,
  });

  const core = JSON.parse(
    await readFile(join(cwd, 'tokens/core.json'), 'utf8'),
  );
  const ptr = core.ptr;
  expect(ptr.ground).toBeDefined();
  expect(ptr.alias).toEqual({ $ref: '#/ptr/ground' });
  expect(ptr.hue.$ref).toBe('#/ptr/ground/$value/components/2');
  expect(ptr.wrapped.$value).toEqual({ $ref: '#/ptr/ground/$value' });

  const { stdout } = await run('node', [bin, 'check', '--json'], { cwd });
  expect(JSON.parse(stdout).ok).toBe(true);
}, 60_000);

test('type mismatches fail check for both reference kinds', async () => {
  const cwd = await exampleFixture('vtk-ptr-');
  await seedPointerTokens(cwd, {
    base: {
      $type: 'color',
      $value: { colorSpace: 'oklch', components: [0.7, 0.32, 328], alpha: 1 },
    },
    wrongAlias: { $type: 'dimension', $value: '{ptr.base}' },
    wrongFragment: { $ref: '#/ptr/base/$value/components/2', $type: 'color' },
  });
  const error = await run('node', [bin, 'check', '--json'], { cwd }).catch(
    (e) => e,
  );
  expect(error.code).toBe(1);
  const mismatches = JSON.parse(error.stdout).diagnostics.filter(
    (d: { code: string }) => d.code === 'token/type-mismatch',
  );
  // one per offender per composition the token participates in — both offenders must appear
  const messages = mismatches
    .map((d: { message: string }) => d.message)
    .join('\n');
  expect(messages).toContain("'ptr.wrongAlias'");
  expect(messages).toContain("'ptr.wrongFragment'");
}, 60_000);
