import { expect, test } from 'vitest';
import type { ResolverDocument } from '../document/resolver-types';
import type { Token } from '../document/types';
import { resolveOrder, resolveValues, validateResolver } from './resolve';

const doc: ResolverDocument = {
  version: '2025.10',
  sets: {
    primitives: { sources: [{ $ref: 'palette.json' }, { $ref: 'scale.json' }] },
    components: { sources: [{ $ref: 'components.json' }] },
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
    { $ref: '#/sets/primitives' },
    { $ref: '#/modifiers/theme' },
    { $ref: '#/sets/components' },
  ],
};

test('resolveOrder: sets append sources; modifier uses default when unselected', () => {
  expect(resolveOrder(doc)).toEqual([
    'palette.json',
    'scale.json',
    'light.json',
    'components.json',
  ]);
});

test('resolveOrder: selection overrides the modifier context', () => {
  expect(resolveOrder(doc, { theme: 'dark' })).toEqual([
    'palette.json',
    'scale.json',
    'dark.json',
    'components.json',
  ]);
});

test('resolveOrder: no default + no selection uses the first context', () => {
  const d: ResolverDocument = {
    ...doc,
    modifiers: {
      theme: { contexts: { a: [{ $ref: 'a.json' }], b: [{ $ref: 'b.json' }] } },
    },
  };
  expect(resolveOrder(d)).toEqual([
    'palette.json',
    'scale.json',
    'a.json',
    'components.json',
  ]);
});

test('resolveOrder: dangling refs and 0-context modifiers are skipped, dups preserved', () => {
  const d: ResolverDocument = {
    version: '2025.10',
    sets: { a: { sources: [{ $ref: 'x.json' }, { $ref: 'x.json' }] } },
    modifiers: { empty: { contexts: {} } },
    resolutionOrder: [
      { $ref: '#/sets/a' },
      { $ref: '#/sets/missing' },
      { $ref: '#/modifiers/empty' },
      { $ref: '#/modifiers/nope' },
    ],
  };
  expect(resolveOrder(d)).toEqual(['x.json', 'x.json']);
});

const known = new Set([
  'palette.json',
  'scale.json',
  'components.json',
  'light.json',
  'dark.json',
]);

test('validateResolver: a clean doc has no issues', () => {
  expect(validateResolver(doc, known)).toEqual([]);
});

test('validateResolver: unknown source → error with ref + target', () => {
  const d: ResolverDocument = {
    version: '2025.10',
    sets: { base: { sources: [{ $ref: 'ghost.json' }] } },
    modifiers: {},
    resolutionOrder: [{ $ref: '#/sets/base' }],
  };
  const issues = validateResolver(d, known);
  expect(issues).toHaveLength(1);
  expect(issues[0]).toMatchObject({
    code: 'unknown-source',
    severity: 'error',
    ref: 'ghost.json',
    target: { kind: 'set', name: 'base' },
  });
});

test('validateResolver: dangling resolutionOrder ref → error', () => {
  const d: ResolverDocument = {
    version: '2025.10',
    sets: {},
    modifiers: {},
    resolutionOrder: [{ $ref: '#/sets/missing' }],
  };
  expect(validateResolver(d, known)).toEqual([
    {
      code: 'dangling-ref',
      severity: 'error',
      message: 'resolutionOrder references undefined set "missing".',
      target: { kind: 'set', name: 'missing' },
    },
  ]);
});

test('validateResolver: empty contexts → error; single context → warning', () => {
  const empty: ResolverDocument = {
    version: '2025.10',
    sets: {},
    modifiers: { m: { contexts: {} } },
    resolutionOrder: [{ $ref: '#/modifiers/m' }],
  };
  expect(
    validateResolver(empty, known).map((i) => [i.code, i.severity]),
  ).toEqual([['empty-contexts', 'error']]);
  const single: ResolverDocument = {
    version: '2025.10',
    sets: {},
    modifiers: { m: { contexts: { only: [{ $ref: 'palette.json' }] } } },
    resolutionOrder: [{ $ref: '#/modifiers/m' }],
  };
  expect(
    validateResolver(single, known).map((i) => [i.code, i.severity]),
  ).toEqual([['single-context', 'warning']]);
});

test('validateResolver: default not among contexts → bad-default error', () => {
  const d: ResolverDocument = {
    version: '2025.10',
    sets: {},
    modifiers: {
      m: {
        contexts: { a: [{ $ref: 'palette.json' }], b: [{ $ref: 'dark.json' }] },
        default: 'c',
      },
    },
    resolutionOrder: [{ $ref: '#/modifiers/m' }],
  };
  expect(validateResolver(d, known).map((i) => i.code)).toContain(
    'bad-default',
  );
});

const mk = (path: string[], value: unknown, set: string): Token => ({
  id: `${set}:${path.join('.')}`,
  path,
  type: 'color',
  value,
  set,
});

const composed: ResolverDocument = {
  version: '2025.10',
  sets: { core: { sources: [{ $ref: 'core.json' }] } },
  modifiers: {
    theme: {
      contexts: {
        light: [{ $ref: 'light.json' }],
        dark: [{ $ref: 'dark.json' }],
      },
      default: 'light',
    },
  },
  resolutionOrder: [{ $ref: '#/sets/core' }, { $ref: '#/modifiers/theme' }],
};
const allTokens: Token[] = [
  mk(['color', 'accent'], '#f59e0b', 'core'),
  mk(['color', 'bg'], '#ffffff', 'light'),
  mk(['color', 'bg'], '#111827', 'dark'),
  mk(['color', 'link'], '{color.accent}', 'light'),
];

test('resolveValues: default selection merges core+light, last-wins, refs preserved', () => {
  const out = resolveValues(composed, {}, allTokens);
  expect(out.map((x) => [x.path.join('.'), x.value])).toEqual([
    ['color.accent', '#f59e0b'],
    ['color.bg', '#ffffff'],
    ['color.link', '{color.accent}'],
  ]);
});

test('resolveValues: selection swaps the context (dark bg wins)', () => {
  const out = resolveValues(composed, { theme: 'dark' }, allTokens);
  const bg = out.find((x) => x.path.join('.') === 'color.bg');
  expect(bg?.value).toBe('#111827');
});

test('resolveValues: a token whose set is not in the order is excluded', () => {
  const out = resolveValues(composed, {}, [
    ...allTokens,
    mk(['color', 'unused'], '#000', 'other'),
  ]);
  expect(out.some((x) => x.path.join('.') === 'color.unused')).toBe(false);
});

test('nested set names round-trip resolutionOrder refs via RFC 6901 escaping, tolerantly', async () => {
  const { escapePointerSegment, orderSetName, resolveOrder } = await import(
    './resolve'
  );
  expect(escapePointerSegment('brands/brand-a')).toBe('brands~1brand-a');
  expect(orderSetName('#/sets/brands~1brand-a')).toBe('brands/brand-a');
  // Hand-authored unescaped refs keep working.
  expect(orderSetName('#/sets/brands/brand-a')).toBe('brands/brand-a');

  const doc = {
    version: '2025.10' as const,
    sets: { 'brands/brand-a': { sources: [{ $ref: 'brands/brand-a.json' }] } },
    modifiers: {},
    resolutionOrder: [{ $ref: '#/sets/brands~1brand-a' }],
  };
  expect(resolveOrder(doc)).toEqual(['brands/brand-a.json']);
});
