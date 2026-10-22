import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';
import {
  asFailure,
  bin,
  exampleFixture,
  unexpectedSuccess,
} from './e2e-fixture';

const run = promisify(execFile);

/**
 * The field report's sequence, on the brands example: `core` is shared by both brands' resolvers,
 * and Globex has no berry ramp — so a shared token on `{color.berry.500}` dangles for Globex until
 * Globex overrides it.
 */
test('a shared token and its brand override land by verbs; ambiguous paths need --set', async () => {
  const cwd = await fixture();
  const vtk = (...args: string[]) => run('node', [bin, ...args], { cwd });
  const tokens = (name: string) => join(cwd, 'tokens', name);

  // A padded key before an integer one, as a hand-written file has it.
  const corePath = tokens('core.json');
  const core = (await readFile(corePath, 'utf8')).replace(
    /^\{\n/,
    '{\n  "motion": {\n    "050": {\n      "$type": "number",\n      "$value": 50\n    },\n    "100": {\n      "$type": "number",\n      "$value": 100\n    }\n  },\n',
  );
  await writeFile(corePath, core);
  const untouched = await readFile(tokens('scheme/dark.json'), 'utf8');

  // Shared first: refused — it dangles for Globex.
  const early = await vtk(
    'token',
    'add',
    'color.accent',
    '{color.berry.500}',
    '--type',
    'color',
    '--set',
    'core',
  ).then(unexpectedSuccess, asFailure);
  expect(early.stderr).toContain('dangling');

  // The override first (a path no set has yet), then the shared token: both accepted.
  await vtk(
    'token',
    'add',
    'color.accent',
    '{color.brand.500}',
    '--type',
    'color',
    '--set',
    'globex/palette',
  );
  await vtk(
    'token',
    'add',
    'color.accent',
    '{color.berry.500}',
    '--type',
    'color',
    '--set',
    'core',
  );

  // Two sets hold the path now: a verb without --set is refused, naming them.
  const ambiguous = await vtk(
    'token',
    'set',
    'color.accent',
    '{color.brand.300}',
  ).then(unexpectedSuccess, asFailure);
  expect(ambiguous.stderr).toContain(
    "'color.accent' is in core, globex/palette — pass --set",
  );
  await vtk(
    'token',
    'set',
    'color.accent',
    '{color.brand.300}',
    '--set',
    'globex/palette',
  );

  const globex = JSON.parse(
    await readFile(tokens('globex/palette.json'), 'utf8'),
  );
  expect(globex.color.accent.$value).toBe('{color.brand.300}');
  const written = await readFile(corePath, 'utf8');
  expect(JSON.parse(written).color.accent.$value).toBe('{color.berry.500}');

  // Writes touched only the sets the commands changed, and kept the source key order.
  expect(await readFile(tokens('scheme/dark.json'), 'utf8')).toBe(untouched);
  expect(written.indexOf('"050"')).toBeLessThan(written.indexOf('"100"'));
  const check = await vtk('check', '--json');
  expect(JSON.parse(check.stdout).ok).toBe(true);
}, 120_000);

const fixture = () => exampleFixture('vtk-sets-', 'brands');
