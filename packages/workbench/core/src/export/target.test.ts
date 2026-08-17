import { expect, test } from 'vitest';
import type { ResolverDocument } from '../document/resolver-types';
import type { Token } from '../document/types';
import type { Exporter, ExporterService } from './exporter';
import { runTargets, targetId } from './target';

const tokens: Token[] = [
  { id: 'core:a', path: ['a'], type: 'color', value: '#fff', set: 'core' },
];
const resolver: ResolverDocument = {
  version: '2025.10',
  sets: { core: { sources: [{ $ref: 'core.json' }] } },
  modifiers: {},
  resolutionOrder: [{ $ref: '#/sets/core' }],
};
const resolvers = new Map([['default', resolver]]);

const echo: Exporter = {
  id: 'echo',
  name: 'Echo',
  transform: (input) => [
    { path: 'out.txt', content: String(input.base.length) },
  ],
};
const registry = (): ExporterService => {
  const byId = new Map([['echo', echo]]);
  return {
    register: () => {},
    get: (id) => byId.get(id),
    list: () => [...byId.values()],
    subscribe: () => () => {},
  };
};

test('targetId defaults to the exporter id', () => {
  expect(targetId({ exporter: 'echo', out: 'build' })).toBe('echo');
  expect(targetId({ id: 'web', exporter: 'echo', out: 'build' })).toBe('web');
});

test('runTargets resolves the composition and returns emitted files', async () => {
  const results = await runTargets(
    [{ id: 'web', exporter: 'echo', composition: 'default', out: 'build' }],
    { registry: registry(), tokens, resolvers },
  );
  expect(results).toHaveLength(1);
  expect(results[0]?.id).toBe('web');
  expect(results[0]?.files).toEqual([{ path: 'out.txt', content: '1' }]);
});

test('runTargets skips disabled targets unless named in `only`', async () => {
  const targets = [
    { id: 'web', exporter: 'echo', out: 'build', enabled: false },
  ];
  const ctx = { registry: registry(), tokens, resolvers };
  expect(await runTargets(targets, ctx)).toHaveLength(0);
  expect(await runTargets(targets, { ...ctx, only: ['web'] })).toHaveLength(1);
});

test('runTargets throws on an unknown exporter id', async () => {
  await expect(
    runTargets([{ exporter: 'nope', out: 'build' }], {
      registry: registry(),
      tokens,
      resolvers,
    }),
  ).rejects.toThrow(/unknown exporter 'nope'/);
});

test('runTargets throws on an unknown composition', async () => {
  await expect(
    runTargets([{ exporter: 'echo', composition: 'ghost', out: 'build' }], {
      registry: registry(),
      tokens,
      resolvers,
    }),
  ).rejects.toThrow(/unknown composition 'ghost'/);
});
