import { execFile } from 'node:child_process';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';
import { bin, exampleFixture } from './e2e-fixture';

const run = promisify(execFile);

test('the outputs example builds both compositions end-to-end', async () => {
  const cwd = await exampleFixture('vtk-outputs-', 'outputs');
  await run('node', [bin, 'check'], { cwd });
  await run('node', [bin, 'build'], { cwd });

  // target `default`: one run, two plugins — css and a js module side by side
  const css = await readFile(join(cwd, 'build/default/tokens.css'), 'utf8');
  expect(css).toContain('--color-text:'); // terrazzo collapsed $root itself
  expect(css).toContain('--color-link: var(--color-text)'); // the $root alias spelling resolves
  expect(css).toContain('--color-accent: var(--color-blue)'); // token-node $ref chain survives
  expect(css).toMatch(/--chroma-accent:\s*0\.2152/); // fragment ref → literal, never var()
  expect(css).not.toMatch(/--[\w-]*root/); // $root never reaches a name
  expect(css).not.toContain('undefined');
  const defaultFiles = await readdir(join(cwd, 'build/default'));
  expect(defaultFiles.length).toBeGreaterThan(1); // js() wrote beside the css

  // target `docs`: a different composition, its own root
  const docs = await readFile(join(cwd, 'build/docs/docs.css'), 'utf8');
  expect(docs).toContain('--color-text:');
  expect(docs).not.toContain('--surface'); // no theme modifier in the docs composition
}, 60_000);

test('a target typo fails check with only the terrazzo extension installed', async () => {
  const cwd = await exampleFixture('vtk-outputs-', 'outputs');
  const configPath = join(cwd, 'vertekum.config.ts');
  const config = await readFile(configPath, 'utf8');
  await writeFile(
    configPath,
    config.replace("exporter: 'terrazzo'", "exporter: 'terazzo'"),
  );

  const error = await run('node', [bin, 'check', '--json'], { cwd }).catch(
    (e) => e,
  );
  expect(error.code).toBe(1);
  expect(error.stdout).toContain('export/unknown-exporter');
}, 60_000);
