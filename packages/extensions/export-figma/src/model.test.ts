import type { ExporterInput, ResolverDocument, Token } from '@vertekum/core';
import { expect, test } from 'vitest';
import { buildModel, type FigmaModel } from './model';
import MODEL_SCHEMA from './model.schema.json';

const OKLCH_RED = {
  colorSpace: 'oklch',
  components: [0.628, 0.258, 29.234],
  alpha: 1,
  hex: '#ff0000',
};
const OKLCH_BLUE = {
  colorSpace: 'oklch',
  components: [0.452, 0.313, 264.052],
  alpha: 1,
  hex: '#0000ff',
};

const token = (
  path: string,
  type: string,
  value: unknown,
  set = 'core',
): Token => ({
  id: `${set}:${path}`,
  path: path.split('.'),
  type,
  value,
  set,
});

const resolver: ResolverDocument = {
  version: '2025.10',
  name: 'brand-a',
  sets: {
    base: { sources: [{ $ref: 'core.json' }] },
    brand: { sources: [{ $ref: 'brand.json' }] },
  },
  modifiers: {
    'color-mode': {
      contexts: { light: [], dark: [{ $ref: 'dark.json' }] },
      default: 'light',
    },
  },
  resolutionOrder: [
    { $ref: '#/sets/base' },
    { $ref: '#/sets/brand' },
    { $ref: '#/modifiers/color-mode' },
  ],
} as unknown as ResolverDocument;

function fixture(): ExporterInput {
  const base = [
    token('color.accent', 'color', OKLCH_RED),
    token('color.text', 'color', '{color.accent}'),
    token('space.gap', 'dimension', { value: 0.5, unit: 'rem' }),
    token('flag.rounded', 'boolean', true),
    token('brand.mark', 'fontFamily', ['Circular', 'sans-serif'], 'brand'),
    token('typography.body', 'typography', {
      fontFamily: ['Circular'],
      fontSize: { value: 16, unit: 'px' },
      fontWeight: 400,
      lineHeight: 1.4,
    }),
    token('gradient.hero', 'gradient', [{ color: OKLCH_RED, position: 0 }]),
    token('spacing.inset', 'spacial', [
      { value: 0, unit: 'px' },
      '{space.gap}',
    ]),
  ];
  // typography member reference: authored notation survives in sourceValue.
  const body = base.find(
    (t) => t.path.join('.') === 'typography.body',
  ) as Token;
  body.sourceValue = {
    ...(body.value as object),
    fontWeight: '{font.regular}',
  };

  const dark = base.map((t) =>
    t.path.join('.') === 'color.accent' ? { ...t, value: OKLCH_BLUE } : t,
  );
  return {
    base,
    variants: [{ modifier: 'color-mode', context: 'dark', tokens: dark }],
    resolver,
    tokens: base,
  };
}

test('the model mirrors the resolver: sets and modifiers become collections', async () => {
  const model = await buildModel(fixture(), { composition: 'brand-a' });

  expect(model.collections.map((c) => c.name)).toEqual([
    'base',
    'brand',
    'color-mode',
  ]);
  const colorMode = model.collections[2];
  expect(colorMode?.modes).toEqual(['light', 'dark']);

  // The varying token lives under the modifier, with per-context converted values.
  const accent = colorMode?.variables.find((v) => v.name === 'color/accent');
  expect(accent?.type).toBe('COLOR');
  const light = accent?.valuesByMode.light as { r: number };
  const dark = accent?.valuesByMode.dark as { b: number };
  expect(light.r).toBeCloseTo(1, 1);
  expect(dark.b).toBeCloseTo(1, 1);

  // Non-varying tokens stay in their set's collection.
  const base = model.collections[0];
  expect(base?.variables.some((v) => v.name === 'space/gap')).toBe(true);
  expect(
    model.collections[1]?.variables.some((v) => v.name === 'brand/mark'),
  ).toBe(true);
});

test('values convert to Figma types; aliases survive as edges', async () => {
  const model = await buildModel(fixture(), { composition: 'brand-a' });
  const base = model.collections[0] as FigmaModel['collections'][0];

  const gap = base.variables.find((v) => v.name === 'space/gap');
  expect(gap?.type).toBe('FLOAT');
  expect(gap?.valuesByMode.default).toBe(8); // 0.5rem → px

  const rounded = base.variables.find((v) => v.name === 'flag/rounded');
  expect(rounded?.type).toBe('BOOLEAN');

  const text = base.variables.find((v) => v.name === 'color/text');
  expect(text?.alias?.default).toBe('color/accent');
  // The lossless half rides along.
  expect(text?.source?.$value).toBe('{color.accent}');
});

test('typography becomes a text style with member-variable bindings', async () => {
  const model = await buildModel(fixture(), { composition: 'brand-a' });
  const style = model.styles.find((s) => s.name === 'typography/body');
  expect(style?.kind).toBe('text');
  const size = style?.properties.find((p) => p.property === 'font-size');
  expect(size?.value).toBe('16px');
  const weight = style?.properties.find((p) => p.property === 'font-weight');
  expect(weight?.variable).toBe('font/regular');
});

test('a types contributor unfolds a custom type; unknown types notice loudly', async () => {
  const model = await buildModel(fixture(), {
    composition: 'brand-a',
    types: {
      spacial: (value) => {
        const entries = value as Array<{ value: number } | string>;
        const sides = ['top-bottom', 'left-right'];
        return entries.map((entry, i) =>
          typeof entry === 'string'
            ? { suffix: sides[i], type: 'FLOAT', alias: entry.slice(1, -1) }
            : { suffix: sides[i], type: 'FLOAT', value: entry.value },
        );
      },
    },
  });
  const base = model.collections[0] as FigmaModel['collections'][0];
  const top = base.variables.find((v) => v.name === 'spacing/inset/top-bottom');
  expect(top?.valuesByMode.default).toBe(0);
  const side = base.variables.find(
    (v) => v.name === 'spacing/inset/left-right',
  );
  expect(side?.alias?.default).toBe('space/gap');

  expect(model.source.notices.some((n) => n.includes("'gradient'"))).toBe(true);
});

test('the emitted model validates against the shipped schema', async () => {
  const model = await buildModel(fixture(), {
    composition: 'brand-a',
    types: {
      spacial: () => [{ type: 'FLOAT', value: 0 }],
    },
  });
  const AjvModule = await import('ajv/dist/2020.js');
  const Ajv = (AjvModule.default ?? AjvModule) as unknown as new (
    o: object,
  ) => { compile(s: object): ((d: unknown) => boolean) & { errors?: unknown } };
  const validate = new Ajv({ strict: false }).compile(MODEL_SCHEMA);
  const valid = validate(JSON.parse(JSON.stringify(model)));
  expect(validate.errors ?? null).toBeNull();
  expect(valid).toBe(true);
});
