import { expect, test } from 'vitest';
import { z } from 'zod';
import type { Exporter, ExporterService } from '../export/exporter';
import { createExporterRegistry } from '../export/registry';
import { targetValidator } from './builtin-validators';

const stub: Exporter = {
  id: 'css',
  name: 'css',
  optionsSchema: z.object({ pad: z.number().optional() }).strict(),
  transform: () => [],
};

function registryWith(exporter: Exporter): ExporterService {
  const registry = createExporterRegistry();
  registry.register(exporter);
  return registry;
}

const base = { tokens: [], sets: [], resolvers: new Map() };

test('an unknown exporter id is an error', async () => {
  const diagnostics = await targetValidator.validate({
    ...base,
    targets: [{ exporter: 'nope', out: 'build' }],
    exporters: registryWith(stub),
  });
  expect(diagnostics[0]?.code).toBe('export/unknown-exporter');
  expect(diagnostics[0]?.source).toBe('core');
});

test('options are validated against the exporter schema', async () => {
  const diagnostics = await targetValidator.validate({
    ...base,
    targets: [{ exporter: 'css', out: 'build', options: { selector: 'x' } }],
    exporters: registryWith(stub),
  });
  expect(diagnostics[0]?.code).toBe('export/invalid-options');
});

test('duplicate target ids are an error', async () => {
  const diagnostics = await targetValidator.validate({
    ...base,
    targets: [
      { id: 'web', exporter: 'css', out: 'a' },
      { id: 'web', exporter: 'css', out: 'b' },
    ],
    exporters: registryWith(stub),
  });
  expect(diagnostics.some((d) => d.code === 'export/duplicate-target-id')).toBe(
    true,
  );
});

test('an unknown composition is an error', async () => {
  const diagnostics = await targetValidator.validate({
    ...base,
    targets: [{ exporter: 'css', composition: 'nope', out: 'build' }],
    exporters: registryWith(stub),
  });
  expect(diagnostics[0]?.code).toBe('export/unknown-composition');
});

test('a valid target produces no diagnostics', async () => {
  const diagnostics = await targetValidator.validate({
    ...base,
    targets: [
      { id: 'web', exporter: 'css', out: 'build', options: { pad: 4 } },
    ],
    exporters: registryWith(stub),
  });
  expect(diagnostics).toEqual([]);
});

test('no targets supplied is a no-op, not an error', async () => {
  expect(await targetValidator.validate(base)).toEqual([]);
});

test('targets without a registry report each exporter as unregistered', async () => {
  const diagnostics = await targetValidator.validate({
    ...base,
    targets: [{ exporter: 'css', out: 'build' }],
  });
  expect(diagnostics[0]?.code).toBe('export/unknown-exporter');
});
