import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';
import { bin, exampleFixture, repoRoot } from './e2e-fixture';

const run = promisify(execFile);

test('the figma exporter emits the model and all three dialect strategies', async () => {
  const cwd = await exampleFixture('vtk-figma-', 'figma');
  await run('node', [bin, 'build'], { cwd });

  const model = JSON.parse(
    await readFile(join(cwd, 'output/native/figma.model.json'), 'utf8'),
  );
  // The composition IS the topology: set → single-mode collection, modifier → modes.
  expect(model.collections.map((c: { name: string }) => c.name)).toEqual([
    'base',
    'color-mode',
    'density',
  ]);
  expect(model.collections[1].modes).toEqual(['light', 'dark']);
  // References survive as alias edges; styles exist beside variables.
  const text = model.collections[0].variables.find(
    (v: { name: string }) => v.name === 'color/text',
  );
  expect(text.alias.default).toBe('color/accent');
  expect(model.styles[0].kind).toBe('text');

  // One manifest per strategy family; split-files fans out per context.
  const native = JSON.parse(
    await readFile(
      join(cwd, 'output/native/microsoft-manifest/manifest.json'),
      'utf8',
    ),
  );
  expect(Object.keys(native.collections)).toEqual([
    'base',
    'color-mode',
    'density',
  ]);
  const split = JSON.parse(
    await readFile(
      join(cwd, 'output/split-collections/microsoft-manifest/manifest.json'),
      'utf8',
    ),
  );
  expect(Object.keys(split.collections)).toContain('color-mode/dark');
  await readFile(
    join(
      cwd,
      'output/split-files/microsoft-manifest/manifest.color-mode.dark.json',
    ),
    'utf8',
  );

  // The example's COMMITTED output is the latest truth of its source: a rebuild in the
  // fixture must reproduce it byte-for-byte, or the committed artifacts have drifted.
  const committed = await readFile(
    join(repoRoot, 'examples/figma/output/native/figma.model.json'),
    'utf8',
  );
  expect(
    await readFile(join(cwd, 'output/native/figma.model.json'), 'utf8'),
  ).toBe(committed);
}, 60_000);
