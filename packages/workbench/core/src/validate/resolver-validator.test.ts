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
  // here would print the same problem twice. In this fixture the resolver references ONLY the
  // missing file, so the real 'core' set is legitimately orphaned — the only finding is the
  // unreferenced-set warning, never an unknown-source echo.
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
  expect(diagnostics.map((d) => d.code)).toEqual(['resolver/unreferenced-set']);
});

function resolver(overrides: Partial<ResolverDocument>): ResolverDocument {
  return {
    version: '2025.10',
    sets: {},
    modifiers: {},
    resolutionOrder: [],
    ...overrides,
  };
}

test('a set no composition mentions draws a warning on the set file', async () => {
  // The Tamblyn shape: sem.json validated, composed by nothing, shipped nowhere.
  const diagnostics = await resolverValidator.validate({
    tokens: [],
    sets: ['core', 'sem'],
    resolvers: new Map([
      [
        'rexall',
        resolver({
          sets: { core: { sources: [{ $ref: 'core.json' }] } },
          resolutionOrder: [{ $ref: '#/sets/core' }],
        }),
      ],
      [
        'lilly',
        resolver({
          sets: { core: { sources: [{ $ref: 'core.json' }] } },
          resolutionOrder: [{ $ref: '#/sets/core' }],
        }),
      ],
    ]),
  });
  expect(diagnostics).toEqual([
    {
      code: 'resolver/unreferenced-set',
      severity: 'warning',
      message:
        "'sem.json' is referenced by no composition — its tokens reach no output",
      source: 'core',
      file: 'sem.json',
    },
  ]);
});

test('any mention anywhere silences the warning — a modifier context, an unordered entry', async () => {
  const diagnostics = await resolverValidator.validate({
    tokens: [],
    sets: ['core', 'light', 'dark', 'staged'],
    resolvers: new Map([
      [
        'default',
        resolver({
          sets: {
            core: { sources: [{ $ref: 'core.json' }] },
            // Defined but absent from resolutionOrder: still a mention, not an orphan.
            staged: { sources: [{ $ref: 'staged.json' }] },
          },
          modifiers: {
            theme: {
              contexts: {
                light: [{ $ref: 'light.json' }],
                dark: [{ $ref: 'dark.json' }],
              },
              default: 'light',
            },
          },
          resolutionOrder: [
            { $ref: '#/sets/core' },
            { $ref: '#/modifiers/theme' },
          ],
        }),
      ],
    ]),
  });
  expect(diagnostics).toEqual([]);
});

test('the flat model never warns — with no resolvers, every set merges', async () => {
  const diagnostics = await resolverValidator.validate({
    tokens: [],
    sets: ['core', 'sem'],
    resolvers: new Map(),
  });
  expect(diagnostics).toEqual([]);
});
