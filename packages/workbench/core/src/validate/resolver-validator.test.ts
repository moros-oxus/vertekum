import { expect, test } from 'vitest';
import type { ResolverDocument } from '../document/resolver-types';
import { resolverValidator } from './builtin-validators';

const broken: ResolverDocument = {
  version: '2025.10',
  sets: { core: { sources: [{ $ref: 'core.json' }] } },
  modifiers: {},
  resolutionOrder: [{ $ref: '#/sets/nope' }],
};

test('resolver diagnostics are namespaced and carry their file', async () => {
  const diagnostics = await resolverValidator.validate({
    tokens: [],
    sets: ['core'],
    resolvers: new Map([['default', broken]]),
  });
  expect(diagnostics.length).toBeGreaterThan(0);
  expect(diagnostics[0]?.code).toBe('resolver/dangling-ref');
  expect(diagnostics[0]?.source).toBe('core');
  expect(diagnostics[0]?.file).toBe('default.resolver.json');
});

test('an unknown source is left to core, which reports it unconditionally', async () => {
  // Reported by the structural pass whether or not this extension is installed; duplicating it
  // here would print the same problem twice.
  const diagnostics = await resolverValidator.validate({
    tokens: [],
    sets: ['core'],
    resolvers: new Map([
      [
        'default',
        {
          version: '2025.10',
          sets: { core: { sources: [{ $ref: 'missing.json' }] } },
          modifiers: {},
          resolutionOrder: [{ $ref: '#/sets/core' }],
        } as ResolverDocument,
      ],
    ]),
  });
  expect(diagnostics).toEqual([]);
});
