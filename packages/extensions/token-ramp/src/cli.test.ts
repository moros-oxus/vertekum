import { createKernel, type DtcgNode } from '@vertekum/core';
import { expect, test } from 'vitest';
import { tokenRampExtension } from './index';
import { RAMP_KEY } from './ramp';

type Node = Record<string, unknown>;

/** A kernel with the ramp extension, hydrated with one five-step teal ramp and what the author adds. */
function project(authored: Node = {}) {
  const kernel = createKernel();
  kernel.register(tokenRampExtension);
  kernel.start();
  kernel.document.hydrate({
    'core.json': {
      brand: { accent: { $type: 'color', $value: '#1DB1A8' } },
      color: {
        teal: {
          $extensions: {
            [RAMP_KEY]: { anchor: '{brand.accent}', scalar: '100-500/100' },
          },
          ...authored,
        },
      },
    },
  });
  const command = kernel.commands.list().find((c) => c.name === 'ramp build');
  if (!command) throw new Error('ramp build is not registered');
  const build = (options: Record<string, unknown> = {}) =>
    command.run({
      project: { document: kernel.document },
      args: {},
      options,
    });
  const tealOf = (files: Record<string, DtcgNode>) =>
    ((files['core.json'] as Node).color as Node).teal as Node;
  const teal = () => tealOf(kernel.document.getFiles());
  /** Edit the file as an author would: a changed file, re-read. */
  const edit = (change: (files: Record<string, DtcgNode>) => void) => {
    const files = structuredClone(kernel.document.getFiles());
    change(files);
    kernel.document.hydrate(files);
  };
  return { build, teal, tealOf, edit };
}

const OVERRIDE = { $type: 'color', $value: '#ff0000' };

test('ramp build marks every stop it writes, and keeps an authored override unmarked', async () => {
  const { build, teal } = project({ '200': OVERRIDE });
  const result = await build();
  expect(result?.summary).toBe(
    'built 1 ramp(s), 4 stop(s), 1 override(s) kept',
  );

  const node = teal();
  expect(node['200']).toEqual(OVERRIDE);
  for (const step of ['100', '300', '400', '500']) {
    expect(((node[step] as Node).$extensions as Node)[RAMP_KEY], step).toBe(
      'committed',
    );
  }
  // The payload stays on the group.
  expect((node.$extensions as Node)[RAMP_KEY]).toBeDefined();
});

test('ramp build rewrites marked stops but never a $root or an override', async () => {
  const root = { $type: 'color', $value: '#000000' };
  const { build, teal, edit } = project({ $root: root, '200': OVERRIDE });
  await build();
  // Move the anchor: committed stops follow, the override and the root do not.
  edit((files) => {
    (files['core.json'] as Node).brand = {
      accent: { $type: 'color', $value: '#B11D5A' },
    };
  });
  const before = JSON.stringify((teal()['100'] as Node).$value);
  await build();
  expect(JSON.stringify((teal()['100'] as Node).$value)).not.toBe(before);
  expect(teal()['200']).toEqual(OVERRIDE);
  expect(teal().$root).toEqual(root);
});

test('--check: overrides are never stale, a missing step is virtual, a stale marked stop fails', async () => {
  const { build, tealOf, edit } = project({ '200': OVERRIDE });
  // Nothing committed yet — a virtual ramp with one override is fresh.
  const virtual = await build({ check: true });
  expect(virtual?.summary).toBe('0 committed ramp(s) fresh, 1 virtual');

  await build();
  edit((files) => {
    delete tealOf(files)['400']; // a missing step is virtual again, not stale
  });
  const fresh = await build({ check: true });
  expect(fresh?.summary).toBe('1 committed ramp(s) fresh, 0 virtual');

  edit((files) => {
    (tealOf(files)['500'] as Node).$value = '#000000';
  });
  await expect(async () => build({ check: true })).rejects.toThrow(
    "stale ramp stop(s): color.teal.500 — run 'ramp build'",
  );
});

test('data.ramps reports effective stops and names the overridden ones', async () => {
  const { build } = project({ '200': OVERRIDE });
  const result = await build({ check: true });
  const [ramp] = (result?.data as { ramps: Node[] }).ramps as [Node];
  expect(ramp.path).toBe('color.teal');
  expect(ramp.committed).toBe(false);
  expect(ramp.overridden).toEqual(['200']);
  const stops = ramp.stops as Node;
  expect(stops['200']).toBe('#ff0000');
  expect(Object.keys(stops)).toEqual(['100', '200', '300', '400', '500']);
  expect(Object.values(stops)).toContain('{brand.accent}'); // the anchor's step, as authored
});
