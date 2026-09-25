import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from 'vitest';
import { bin, exampleFixture, repoRoot } from './e2e-fixture';

const run = promisify(execFile);

type Model = {
  source: { fingerprint: string };
  collections: Array<{
    name: string;
    modes: string[];
    variables: Array<{ name: string }>;
  }>;
};

const structure = (model: Model) =>
  model.collections.map((c) => ({
    name: c.name,
    modes: c.modes,
    variables: c.variables.map((v) => v.name).sort(),
  }));

const readModel = async (cwd: string): Promise<Model> =>
  JSON.parse(
    await readFile(join(cwd, 'output/figma/figma.model.json'), 'utf8'),
  );

test('the brands reference structure: four small collections, committed outputs reproduce', async () => {
  const cwd = await exampleFixture('vtk-brands-', 'brands');
  await run('node', [bin, 'build'], { cwd });
  const model = await readModel(cwd);

  // Each axis one collection; only the palette differs per brand; the scheme is shared.
  expect(model.collections.map((c) => [c.name, c.modes.join(',')])).toEqual([
    ['core', 'default'],
    ['palette', 'acme,globex'],
    ['sub-theme', 'acme/standard,acme/vivid,globex/standard'],
    ['color-scheme', 'light,dark'],
  ]);

  // The committed artifacts are what a fresh build produces, byte for byte.
  for (const file of [
    'output/figma/figma.model.json',
    'output/css/acme/acme.css',
    'output/css/globex/globex.css',
  ]) {
    expect(await readFile(join(cwd, file), 'utf8')).toBe(
      await readFile(join(repoRoot, 'examples/brands', file), 'utf8'),
    );
  }
}, 60_000);

test('a value edit moves nothing — the structure is the resolvers’, only the fingerprint changes', async () => {
  const cwd = await exampleFixture('vtk-brands-', 'brands');
  await run('node', [bin, 'build'], { cwd });
  const before = await readModel(cwd);

  // Retune globex's brand anchor and flip a dark-scheme step: values only.
  const palette = join(cwd, 'tokens/globex/palette.json');
  const edited = JSON.parse(await readFile(palette, 'utf8'));
  edited.anchor.brand.$value.components[2] = 20;
  await writeFile(palette, JSON.stringify(edited));
  const dark = join(cwd, 'tokens/scheme/dark.json');
  const scheme = JSON.parse(await readFile(dark, 'utf8'));
  scheme.surface.background.$value = '{color.neutral.800}';
  await writeFile(dark, JSON.stringify(scheme));

  await run('node', [bin, 'build'], { cwd });
  const after = await readModel(cwd);
  expect(structure(after)).toEqual(structure(before));
  expect(after.source.fingerprint).not.toBe(before.source.fingerprint);
}, 60_000);
