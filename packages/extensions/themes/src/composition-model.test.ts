import type { ResolverDocument } from 'vertekum';
import { expect, test } from 'vitest';
import { fromEntries, toEntries } from './composition-model';

const doc: ResolverDocument = {
  version: '2025.10',
  name: 'Acme',
  sets: {
    primitives: {
      description: 'base',
      sources: [{ $ref: 'palette.json' }, { $ref: 'scale.json' }],
    },
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
  $schema: 'https://x',
};

test('toEntries orders sets + modifiers per resolutionOrder', () => {
  const entries = toEntries(doc);
  expect(entries.map((e) => `${e.kind}:${e.name}`)).toEqual([
    'set:primitives',
    'modifier:theme',
    'set:components',
  ]);
  expect(entries[0]).toEqual({
    kind: 'set',
    name: 'primitives',
    description: 'base',
    sources: ['palette.json', 'scale.json'],
  });
  expect(entries[1]).toEqual({
    kind: 'modifier',
    name: 'theme',
    contexts: [
      { name: 'light', sources: ['light.json'] },
      { name: 'dark', sources: ['dark.json'] },
    ],
    default: 'light',
  });
});

test('fromEntries rebuilds maps + order and preserves meta/pass-through', () => {
  expect(fromEntries(toEntries(doc), doc)).toEqual(doc);
});

test('a dangling resolutionOrder ref is dropped', () => {
  const d: ResolverDocument = {
    ...doc,
    resolutionOrder: [...doc.resolutionOrder, { $ref: '#/sets/missing' }],
  };
  expect(toEntries(d).length).toBe(3);
});
