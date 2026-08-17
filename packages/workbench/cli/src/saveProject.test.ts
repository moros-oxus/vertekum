import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { renamePath } from 'vertekum/core';
import { expect, test } from 'vitest';
import { exampleFixture } from './e2e-fixture';
import { loadProject } from './loadProject';
import { saveProject } from './saveProject';

test('loadProject hydrates the kernel document', async () => {
  const cwd = await exampleFixture('vtk-save-');
  const project = await loadProject(cwd);
  expect(project.document.getSets().sort()).toEqual(['core', 'dark', 'light']);
  expect(project.document.getAllTokens().length).toBeGreaterThan(0);
  expect([...project.document.getResolvers().keys()]).toEqual(['default']);
});

test('saveProject writes the mutated document to disk', async () => {
  const cwd = await exampleFixture('vtk-save-');
  const project = await loadProject(cwd);

  project.document.apply(
    renamePath(['color', 'red', '900'], ['color', 'red', '950']),
  );
  const changed = await saveProject(project);

  expect(changed).toContain('core.json');
  const light = await readFile(join(cwd, 'tokens/light.json'), 'utf8');
  expect(light).toContain('{color.red.950}');
});

test('saveProject with dryRun reports the files but writes nothing', async () => {
  const cwd = await exampleFixture('vtk-save-');
  const project = await loadProject(cwd);
  const before = await readFile(join(cwd, 'tokens/core.json'), 'utf8');

  project.document.apply(
    renamePath(['color', 'red', '900'], ['color', 'red', '950']),
  );
  const changed = await saveProject(project, { dryRun: true });

  expect(changed).toContain('core.json');
  expect(await readFile(join(cwd, 'tokens/core.json'), 'utf8')).toBe(before);
});

test('saveProject reports nothing when the document is unchanged', async () => {
  const cwd = await exampleFixture('vtk-save-');
  const project = await loadProject(cwd);
  expect(await saveProject(project)).toEqual([]);
});
