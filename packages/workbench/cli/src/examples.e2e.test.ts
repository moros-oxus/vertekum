import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';
import { bin, repoRoot } from './e2e-fixture';

const run = promisify(execFile);

/**
 * The examples are documentation that can rot, and rotten documentation is worse than none. These
 * run the real CLI against them in place — read-only, so no fixture copy is needed.
 */

const schemasExample = join(repoRoot, 'examples/schemas');
const agenticExample = join(repoRoot, 'examples/agentic');

test('examples/schemas passes check', async () => {
  const { stdout } = await run('node', [bin, 'check', '--json'], {
    cwd: schemasExample,
  });
  expect(JSON.parse(stdout).ok).toBe(true);
}, 60_000);

test('examples/schemas route 2: the ejected copy grants marketing, refuses inventions', async () => {
  // Acceptance is pinned by `check` above — semantic.json CONTAINS color.text.marketing, so a
  // clean check proves the granted name. The refusal writes nothing, keeping the example clean.
  const error = await run(
    'node',
    [bin, 'token', 'add', 'color.text.bland', '"#000"', '--set', 'semantic'],
    { cwd: schemasExample },
  ).catch((e) => e);
  expect(error.code).toBe(1);
  expect(error.stderr).toContain('refused');
  expect(error.stderr).toContain('marketing');
}, 60_000);

test('examples/schemas binds all three routes, each to its own set', async () => {
  const { stdout } = await run('node', [bin, 'describe', '--json'], {
    cwd: schemasExample,
  });
  const schemas = JSON.parse(stdout).schemas as Array<{
    match: string;
    id: string | null;
    file: string | null;
  }>;

  // A hand-written schema, an extension of a packaged one, and an ejected replacement — bound to
  // different sets, which is the whole point of the example.
  expect(schemas.map((s) => s.match)).toEqual([
    '*', // the bundled DTCG resolver schema
    'house.json',
    'semantic.json',
    '*', // the ejected DTCG token schema, REPLACING the bundled one
  ]);
  expect(schemas.filter((s) => s.id === 'dtcg-tokens')).toHaveLength(1);
  expect(schemas.at(-1)?.file?.endsWith('schemas/dtcg-tokens.json')).toBe(true);
});

test('examples/agentic passes check and its vocabulary bites', async () => {
  const { stdout } = await run('node', [bin, 'check', '--json'], {
    cwd: agenticExample,
  });
  expect(JSON.parse(stdout).ok).toBe(true);

  const error = await run(
    'node',
    [bin, 'token', 'add', 'color.text.bland', '"#000"', '--set', 'text'],
    { cwd: agenticExample },
  ).catch((e) => e);

  // Refused, so nothing is written and the example stays clean for the next run.
  expect(error.code).toBe(1);
  expect(error.stderr).toContain('refused');
}, 60_000);

const extensionsExample = join(repoRoot, 'examples/extensions');

test('examples/extensions: extended types check clean and the patched schema bites', async () => {
  const { stdout } = await run('node', [bin, 'check', '--json'], {
    cwd: extensionsExample,
  });
  expect(JSON.parse(stdout).ok).toBe(true);

  // A value outside the extended enum is refused by the PATCHED dtcg binding at the exact
  // pointer — refused means nothing is written and the example stays clean.
  const error = await run(
    'node',
    [bin, 'token', 'set', 'font.case.upper', 'sparkle'],
    { cwd: extensionsExample },
  ).catch((e) => e);
  expect(error.code).toBe(1);
  expect(error.stderr).toContain('schema/enum');
  expect(error.stderr).toContain('/font/case/upper/$value');
}, 60_000);

test('examples/extensions: describe shows the assembled bindings with origins', async () => {
  const { stdout } = await run('node', [bin, 'describe', '--json'], {
    cwd: extensionsExample,
  });
  const schemas = JSON.parse(stdout).schemas as Array<{
    id: string | null;
    origin: string | null;
  }>;
  // The patch documents merged away; the surviving dtcg-tokens binding is core's, patched.
  expect(schemas.filter((s) => s.id === 'dtcg-tokens')).toHaveLength(1);
  expect(schemas.map((s) => s.origin)).toContain('core');
}, 60_000);
