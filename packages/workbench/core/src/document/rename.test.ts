import { expect, test } from 'vitest';
import { parseCollection } from '../dtcg/parse';
import { planRename } from './rename';
import type { Token } from './types';

const t = (id: string, path: string, value: unknown, set: string): Token => ({
  id,
  path: path.split('.'),
  type: 'color',
  value,
  set,
});

/** core defines the ramp; light + dark both alias it under the same semantic path. */
const collection: Token[] = [
  t('c1', 'color.red.100', '#fee2e2', 'core'),
  t('c2', 'color.red.900', '#7f1d1d', 'core'),
  t('c3', 'color.gray.900', '#111827', 'core'),
  t('l1', 'color.brand.primary', '{color.red.900}', 'light'),
  t('d1', 'color.brand.primary', '{color.red.100}', 'dark'),
];

test('a leaf rename repaths the token and rewrites the alias targeting it', () => {
  const plan = planRename(
    collection,
    ['color', 'red', '900'],
    ['color', 'red', '950'],
  );
  expect(plan.isGroup).toBe(false);
  expect(plan.repathed).toEqual([
    { id: 'c2', set: 'core', path: ['color', 'red', '950'] },
  ]);
  expect(plan.rewritten).toEqual([
    { id: 'l1', set: 'light', value: '{color.red.950}' },
  ]);
  expect(plan.collisions).toEqual([]);
});

test('a group rename moves every descendant and rewrites every alias into it', () => {
  const plan = planRename(collection, ['color', 'red'], ['color', 'danger']);
  expect(plan.isGroup).toBe(true);
  expect(plan.repathed.map((r) => r.id).sort()).toEqual(['c1', 'c2']);
  expect(plan.rewritten.map((r) => r.value).sort()).toEqual([
    '{color.danger.100}',
    '{color.danger.900}',
  ]);
});

test('a path defined in several sets is repathed in all of them', () => {
  const plan = planRename(
    collection,
    ['color', 'brand', 'primary'],
    ['color', 'brand', 'main'],
  );
  expect(plan.repathed.map((r) => r.set).sort()).toEqual(['dark', 'light']);
  expect(
    plan.repathed.every((r) => r.path.join('.') === 'color.brand.main'),
  ).toBe(true);
});

test('prefix matching is segment-wise, not string-wise', () => {
  const tokens = [
    t('a', 'color.gray.900', '#111', 'core'),
    t('b', 'color.gray.9000', '#222', 'core'),
  ];
  const plan = planRename(
    tokens,
    ['color', 'gray', '900'],
    ['color', 'gray', '950'],
  );
  expect(plan.repathed.map((r) => r.id)).toEqual(['a']);
});

test('references to unrelated paths are left alone', () => {
  const plan = planRename(
    collection,
    ['color', 'gray', '900'],
    ['color', 'gray', '950'],
  );
  expect(plan.rewritten).toEqual([]);
});

test('landing on an occupied path is a collision', () => {
  const plan = planRename(
    collection,
    ['color', 'red', '900'],
    ['color', 'gray', '900'],
  );
  expect(plan.collisions).toEqual(['color.gray.900']);
});

test('nesting a token under an existing token is a collision', () => {
  const plan = planRename(
    collection,
    ['color', 'red'],
    ['color', 'gray', '900'],
  );
  expect(plan.collisions.length).toBeGreaterThan(0);
});

test('landing a token where a group already exists is a collision', () => {
  const plan = planRename(
    collection,
    ['color', 'gray', '900'],
    ['color', 'red'],
  );
  expect(plan.collisions).toEqual(['color.red']);
});

test('the same path in another set is not a collision', () => {
  // 'color.brand.primary' exists in light AND dark; renaming it is the normal case.
  const plan = planRename(
    collection,
    ['color', 'brand', 'primary'],
    ['color', 'brand', 'main'],
  );
  expect(plan.collisions).toEqual([]);
});

test('a path matching nothing plans no work', () => {
  const plan = planRename(collection, ['color', 'nope'], ['color', 'other']);
  expect(plan.repathed).toEqual([]);
  expect(plan.rewritten).toEqual([]);
  expect(plan.collisions).toEqual([]);
});

test('renaming a pointer target rewrites token-position pointers, fragment tails intact', () => {
  const tokens = parseCollection({
    'core.json': {
      colors: {
        blue: {
          $type: 'color',
          $value: { colorSpace: 'srgb', components: [0, 0.4, 0.8] },
        },
      },
      hue: { $ref: '#/colors/blue/$value/components/0', $type: 'number' },
    },
  });
  const plan = planRename(tokens, ['colors', 'blue'], ['colors', 'azure']);
  expect(plan.rewritten).toEqual([
    expect.objectContaining({ ref: '#/colors/azure/$value/components/0' }),
  ]);
});

test('renaming rewrites value-position pointers inside sourceValue', () => {
  const tokens = parseCollection({
    'core.json': {
      blue: {
        $value: { colorSpace: 'srgb', components: [0, 0.4, 0.8] },
        $type: 'color',
      },
      wrapped: { $type: 'color', $value: { $ref: '#/blue/$value' } },
    },
  });
  const plan = planRename(tokens, ['blue'], ['navy']);
  expect(plan.rewritten).toEqual([
    expect.objectContaining({ value: { $ref: '#/navy/$value' } }),
  ]);
});

test('pointer rewrite escapes segments with / and ~', () => {
  const tokens = parseCollection({
    'core.json': { 'a/b': { $value: 1 }, p: { $ref: '#/a~1b' } },
  });
  const plan = planRename(tokens, ['a/b'], ['a~b']);
  expect(plan.rewritten).toEqual([expect.objectContaining({ ref: '#/a~0b' })]);
});

test('a group rename rewrites pointers through the group prefix', () => {
  const tokens = parseCollection({
    'core.json': {
      color: { text: { $value: '#111' } },
      alias: { $ref: '#/color/text' },
    },
  });
  const plan = planRename(tokens, ['color'], ['colour']);
  expect(plan.rewritten).toEqual([
    expect.objectContaining({ ref: '#/colour/text' }),
  ]);
});

test('renaming a group rewrites {group} aliases that resolve through its $root', () => {
  const tokens: Token[] = [
    {
      id: 'core:color.steel.$root',
      path: ['color', 'steel', '$root'],
      type: 'color',
      value: '#5f6a7b',
      set: 'core',
    },
    {
      id: 'sem:border.default',
      path: ['border', 'default'],
      type: 'color',
      value: '{color.steel}',
      set: 'sem',
    },
  ];
  const plan = planRename(tokens, ['color', 'steel'], ['color', 'metal']);
  expect(plan.collisions).toEqual([]);
  expect(plan.rewritten).toEqual([
    { id: 'sem:border.default', set: 'sem', value: '{color.metal}' },
  ]);
});
