import { execFile } from 'node:child_process';
import { copyFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';
import { bin, exampleFixture } from './e2e-fixture';

const run = promisify(execFile);
const fixture = () => exampleFixture('vtk-mock-', 'schemas');

test('schema mock: names listing, clean mock validates, broken mock fails on the marked tokens', async () => {
  const cwd = await fixture();

  await run(
    'node',
    [
      bin,
      'schema',
      'mock',
      'schemas/house.dfn',
      '--break',
      '0.6',
      '--seed',
      '5',
    ],
    { cwd },
  );

  const names = await readFile(join(cwd, 'mocks/house.names.md'), 'utf8');
  expect(names).toContain('granted names (least)');
  expect(names).toContain('## color (');

  // The clean mock IS a valid instance of the vocabulary it was generated from.
  await copyFile(
    join(cwd, 'mocks/house.mock.tokens.json'),
    join(cwd, 'tokens/house.json'),
  );
  const clean = await run('node', [bin, 'check', '--json'], { cwd });
  expect(JSON.parse(clean.stdout).ok).toBe(true);

  // The broken sibling fails check on exactly the marked tokens.
  const brokenText = await readFile(
    join(cwd, 'mocks/house.broken.tokens.json'),
    'utf8',
  );
  const marked = brokenText.split('deliberately broken').length - 1;
  expect(marked).toBeGreaterThan(0);
  await copyFile(
    join(cwd, 'mocks/house.broken.tokens.json'),
    join(cwd, 'tokens/house.json'),
  );
  const refused = await run('node', [bin, 'check', '--json'], { cwd }).catch(
    (e: { code: number; stdout: string }) => e,
  );
  expect(refused.code).toBe(1);
  const report = JSON.parse(refused.stdout);
  // Diagnostics curate to one per location (two name-breaks under one parent collapse), so the
  // guarantee is: errors exist, and every error is ABOUT a break, not noise.
  expect(report.errors).toBeGreaterThan(0);
  expect(report.errors).toBeLessThanOrEqual(marked);
  expect(
    report.diagnostics.every(
      (d: { message: string }) =>
        d.message.includes('-broken') || d.message.includes('must be'),
    ),
  ).toBe(true);
}, 120_000);

test('schema mock is deterministic at a fixed seed and honors --style/--coverage', async () => {
  const cwd = await fixture();
  const args = ['schema', 'mock', 'schemas/house.dfn', '--break', '0.5'];
  await run('node', [bin, ...args], { cwd });
  const first = await readFile(
    join(cwd, 'mocks/house.broken.tokens.json'),
    'utf8',
  );
  await run('node', [bin, ...args], { cwd });
  const second = await readFile(
    join(cwd, 'mocks/house.broken.tokens.json'),
    'utf8',
  );
  expect(second).toBe(first);

  const { stdout } = await run(
    'node',
    [
      bin,
      'schema',
      'mock',
      'schemas/house.dfn',
      '--style',
      'names',
      '--coverage',
      'full',
      '--json',
    ],
    { cwd },
  );
  const report = JSON.parse(stdout);
  expect(report.files).toEqual(['mocks/house.names.md']);
}, 120_000);
