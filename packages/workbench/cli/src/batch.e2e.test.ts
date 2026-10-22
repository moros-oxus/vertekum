import { execFile, spawn } from 'node:child_process';
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
const fixture = () => exampleFixture('vtk-batch-', 'brands');

// The field report's sequence in its natural order — shared token first — which no sequence of
// single verbs can do: alone, the shared token dangles for Globex (no berry ramp).
const BATCH = `# a shared token and its brand override, together
vertekum token add color.accent '{color.berry.500}' --type color --set core
vertekum token add color.accent '{color.brand.500}' --type color --set globex/palette
`;

test('vertekum batch: dry-run previews, a real run writes once, --json reports each line', async () => {
  const cwd = await fixture();
  await writeFile(join(cwd, 'changes.batch'), BATCH);
  const corePath = join(cwd, 'tokens/core.json');
  const before = await readFile(corePath, 'utf8');

  const preview = await run(
    'node',
    [bin, 'batch', 'changes.batch', '--dry-run'],
    { cwd },
  );
  expect(preview.stdout).toContain('2: added color.accent');
  expect(preview.stdout).toContain('would write core.json');
  expect(await readFile(corePath, 'utf8')).toBe(before);

  const real = await run('node', [bin, 'batch', 'changes.batch', '--json'], {
    cwd,
  });
  const report = JSON.parse(real.stdout);
  expect(report.ok).toBe(true);
  expect(report.results.map((r: { line: number }) => r.line)).toEqual([2, 3]);
  expect(JSON.parse(await readFile(corePath, 'utf8')).color.accent.$value).toBe(
    '{color.berry.500}',
  );
  const check = await run('node', [bin, 'check', '--json'], { cwd });
  expect(JSON.parse(check.stdout).ok).toBe(true);
}, 120_000);

test('vertekum batch - reads stdin; a bad line exits 2 before anything runs', async () => {
  const cwd = await fixture();
  const corePath = join(cwd, 'tokens/core.json');
  const before = await readFile(corePath, 'utf8');

  const bad = await run('node', [bin, 'batch', 'missing.batch'], { cwd }).then(
    unexpectedSuccess,
    asFailure,
  );
  expect(bad.code).toBe(2);
  expect(bad.stderr).toContain("can't read batch file 'missing.batch'");

  const piped = await new Promise<{ code: number | null; stderr: string }>(
    (done) => {
      const child = spawn('node', [bin, 'batch', '-'], { cwd });
      let stderr = '';
      child.stderr.on('data', (chunk) => {
        stderr += String(chunk);
      });
      child.on('close', (code) => done({ code, stderr }));
      child.stdin.end(`${BATCH}vertekum check\n`);
    },
  );
  expect(piped.code).toBe(2);
  expect(piped.stderr).toContain("line 4: 'check' can't run in a batch");
  expect(await readFile(corePath, 'utf8')).toBe(before);
}, 120_000);
