import { execFile } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';

const run = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../../..');
const script = join(here, '../scripts/assert-headless.mjs');

/** Extension `api` surfaces that must load in plain Node — no React, no CSS (ADR-0029). */
const API_SURFACES = [
  'packages/extensions/dashboard/src/api.ts',
  'packages/extensions/stats/src/api.ts',
  'packages/extensions/themes/src/api.ts',
  'packages/extensions/value-editors/src/api.ts',
  'packages/extensions/tokens/src/api.ts',
  'packages/extensions/release/src/api.ts',
  'packages/extensions/export/src/api.ts',
  'packages/schemas/builder/src/api.ts',
];

test('extension api surfaces load in plain Node', async () => {
  const { stdout } = await run(
    'node',
    [
      '--import',
      'tsx/esm',
      script,
      ...API_SURFACES.map((p) => join(repoRoot, p)),
    ],
    { cwd: repoRoot },
  );
  expect(stdout.trim()).toBe(`ok ${API_SURFACES.length}`);
}, 30_000);

test('the example config boots headlessly with no UI module loaded', async () => {
  const { stdout } = await run(
    'node',
    [
      '--import',
      'tsx/esm',
      script,
      join(repoRoot, 'examples/unabridged/vertekum.config.ts'),
    ],
    { cwd: repoRoot },
  );
  expect(stdout.trim()).toBe('ok 1');
}, 30_000);
