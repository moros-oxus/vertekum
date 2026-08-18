import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXPORTER_SERVICE, type ExporterService } from '@vertekum/core';
import { expect, test } from 'vitest';
import { loadProject } from './loadProject';

const repoRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../..',
);

test('loadProject boots the example config headlessly', async () => {
  const project = await loadProject(join(repoRoot, 'examples/unabridged'));
  expect(project.projectDir).toBe(join(repoRoot, 'examples/unabridged'));
  expect(project.collectionDir).toBe(
    join(repoRoot, 'examples/unabridged/tokens'),
  );
  expect(project.document.getSets().sort()).toEqual(['core', 'dark', 'light']);
  expect([...project.document.getResolvers().keys()]).toEqual(['default']);
  const registry =
    project.kernel.services.get<ExporterService>(EXPORTER_SERVICE);
  expect(registry?.list().map((e) => e.id)).toContain('css');
});
