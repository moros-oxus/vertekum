import { expect, test } from 'vitest';
import type { ResolverDocument } from '../document/resolver-types';
import { parseCollection } from '../dtcg/parse';
import { deprecationValidator } from './builtin-validators';

const files = {
  'core.json': {
    color: {
      $type: 'color',
      old: { $value: '#f00', $deprecated: 'Use {color.new}' },
      gone: { $value: '#0f0', $deprecated: true },
      new: { $value: '#fff' },
      // A live alias to a deprecated token…
      text: { $value: '{color.old}' },
      // …and a deprecated alias to one: both going away, so it is silent.
      legacy: { $value: '{color.gone}', $deprecated: true },
      // A pointer into a deprecated token's value.
      tint: {
        $value: {
          colorSpace: 'srgb',
          components: [{ $ref: '#/color/gone/$value/components/0' }, 0, 0],
          alpha: 1,
        },
      },
    },
    shadow: {
      card: {
        $type: 'shadow',
        $value: {
          color: '{color.gone}',
          offsetX: { value: 0, unit: 'px' },
          offsetY: { value: 1, unit: 'px' },
          blur: { value: 2, unit: 'px' },
          spread: { value: 0, unit: 'px' },
        },
      },
    },
    surface: { $type: 'color', $ref: '#/color/old' },
  },
};

const resolver: ResolverDocument = {
  version: '2025.10',
  sets: { core: { sources: [{ $ref: 'core.json' }] } },
  modifiers: {},
  resolutionOrder: [{ $ref: '#/sets/core' }],
};

async function diagnose(withResolver: boolean) {
  return deprecationValidator.validate({
    tokens: parseCollection(files),
    sets: ['core'],
    resolvers: withResolver
      ? new Map([['default', resolver]])
      : new Map<string, ResolverDocument>(),
  });
}

test('live uses of a deprecated token warn: alias, composite member, value pointer, $ref', async () => {
  for (const withResolver of [false, true]) {
    const diagnostics = await diagnose(withResolver);
    expect(
      diagnostics.every((d) => d.code === 'token/deprecated-reference'),
    ).toBe(true);
    expect(diagnostics.every((d) => d.severity === 'warning')).toBe(true);
    expect(diagnostics.map((d) => d.message).sort()).toEqual([
      "'color.text' references deprecated 'color.old' — Use {color.new}",
      "'color.tint' references deprecated 'color.gone'",
      "'shadow.card' references deprecated 'color.gone'",
      "'surface' references deprecated 'color.old' — Use {color.new}",
    ]);
  }
});

test('nothing deprecated, nothing reported', async () => {
  const diagnostics = await deprecationValidator.validate({
    tokens: parseCollection({
      'core.json': {
        a: { $type: 'color', $value: '#fff' },
        b: { $type: 'color', $value: '{a}' },
      },
    }),
    sets: ['core'],
    resolvers: new Map(),
  });
  expect(diagnostics).toEqual([]);
});
