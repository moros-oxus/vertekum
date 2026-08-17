import css from '@terrazzo/plugin-css';
import {
  type DtcgNode,
  emptyResolver,
  parseCollection,
  type ResolverDocument,
} from '@vertekum/core';
import { expect, test } from 'vitest';
import { TerrazzoOptions, terrazzoExporter } from './terrazzo';
import { correctKnownLimitations } from './to-terrazzo';

const color = (hex: string, components: number[]) => ({
  colorSpace: 'srgb',
  components,
  alpha: 1,
  hex,
});

const CORE: DtcgNode = {
  color: {
    $extensions: { 'org.vertekum.scale': { base: 4 } },
    blue: { $type: 'color', $value: color('#0066cc', [0, 0.4, 0.8]) },
    text: {
      $root: { $type: 'color', $value: color('#111111', [0.07, 0.07, 0.07]) },
      subtle: { $type: 'color', $value: color('#222222', [0.13, 0.13, 0.13]) },
    },
  },
  link: { $type: 'color', $value: '{color.text.$root}' },
  ptr: { $ref: '#/color/blue' },
  lift: { $ref: '#/color/blue/$value', $type: 'color' },
  hue: { $ref: '#/color/blue/$value/components/1', $type: 'number' },
  odd: {
    $type: 'number',
    $value: { $ref: '#/color/blue/$value/components/1' },
  },
};

const RESOLVER: ResolverDocument = {
  version: '2025.10',
  name: 'default',
  sets: { core: { sources: [{ $ref: 'core.json' }] } },
  modifiers: {
    theme: {
      default: 'light',
      contexts: { light: [{ $ref: 'light.json' }] },
    },
  },
  resolutionOrder: [{ $ref: '#/sets/core' }, { $ref: '#/modifiers/theme' }],
};

const LIGHT: DtcgNode = {
  surface: { $type: 'color', $value: color('#ffffff', [1, 1, 1]) },
};

test('staging passes $root, aliases, and $extensions verbatim; corrects only fragments', () => {
  const files = { 'core.json': { ...CORE, broken: { $ref: '#/nope' } } };
  const tokens = parseCollection(files);
  const corrected = correctKnownLimitations(
    files['core.json'],
    tokens,
    'core',
  ) as Record<string, Record<string, unknown>>;

  // verbatim: extensions, $root, alias spelling, token-node $ref, dangling ref
  expect((corrected.color as Record<string, unknown>).$extensions).toEqual({
    'org.vertekum.scale': { base: 4 },
  });
  const text = corrected.color.text as Record<string, Record<string, unknown>>;
  expect(text.$root.$value).toEqual(color('#111111', [0.07, 0.07, 0.07]));
  expect(corrected.link.$value).toBe('{color.text.$root}');
  expect(corrected.ptr).toEqual({ $ref: '#/color/blue' });
  expect(corrected.broken).toEqual({ $ref: '#/nope' }); // stays authored; terrazzo fails loudly

  // corrected: $value-crossing and fragment forms, swapped for materialized literals
  expect(corrected.lift.$ref).toBeUndefined();
  expect(corrected.lift.$value).toEqual(color('#0066cc', [0, 0.4, 0.8]));
  expect(corrected.hue).toEqual({ $type: 'number', $value: 0.4 });
  expect(corrected.odd).toEqual({ $type: 'number', $value: 0.4 });
});

test('§7.3 fragment corrections: dimension unit, typography sub-value', () => {
  const files = {
    'core.json': {
      space: { $type: 'dimension', $value: { value: 4, unit: 'px' } },
      body: {
        $type: 'typography',
        $value: {
          fontFamily: 'Inter',
          fontSize: { value: 16, unit: 'px' },
          lineHeight: 1.5,
        },
      },
      unitOf: { $type: 'string', $value: { $ref: '#/space/$value/unit' } },
      leading: { $ref: '#/body/$value/lineHeight', $type: 'number' },
    },
  };
  const tokens = parseCollection(files);
  const corrected = correctKnownLimitations(
    files['core.json'],
    tokens,
    'core',
  ) as Record<string, Record<string, unknown>>;
  expect(corrected.unitOf.$value).toBe('px');
  expect(corrected.leading).toEqual({ $type: 'number', $value: 1.5 });
});

test('the option surface is strict: colliding terrazzo keys fail loudly', () => {
  expect(() => TerrazzoOptions.parse({ outDir: './x' })).toThrow(/outDir/);
  expect(() => TerrazzoOptions.parse({ plugins: [] })).not.toThrow();
});

test('no plugins yields no output rather than throwing', async () => {
  await expect(
    terrazzoExporter.transform({
      base: [],
      variants: [],
      tokens: [],
      resolver: emptyResolver(),
      files: {},
    }),
  ).resolves.toEqual([]);
});

test('missing input.files is a clear error, not silent emptiness', async () => {
  await expect(
    terrazzoExporter.transform({
      base: [],
      variants: [],
      tokens: [],
      resolver: emptyResolver(),
      options: { plugins: [css()] },
    }),
  ).rejects.toThrow(/files/);
});

test('PINS terrazzo: resolver-driven hand-off, $root naming, ref chains, fragment literals', async () => {
  const files = { 'core.json': CORE, 'light.json': LIGHT };
  const tokens = parseCollection(files);
  const out = await terrazzoExporter.transform({
    base: tokens,
    variants: [],
    tokens,
    resolver: RESOLVER,
    files,
    options: { plugins: [css()] },
  });
  const sheet = out.map((f) => f.content).join('\n');
  expect(sheet).toContain('--color-text:'); // terrazzo collapsed $root itself
  expect(sheet).toContain('--link: var(--color-text)'); // $root alias spelling resolves
  expect(sheet).toContain('--ptr: var(--color-blue)'); // token-node $ref chain survives
  expect(sheet).toMatch(/--lift:\s*rgb/); // /$value ref materialized, not dropped
  expect(sheet).toMatch(/--hue:\s*0\.4/); // fragment → literal
  expect(sheet).toMatch(/--odd:\s*0\.4/); // value-position fragment → literal, never var()
  expect(sheet).toContain('--surface:'); // the resolver's modifier context, resolved by terrazzo
  expect(sheet).not.toMatch(/--[\w-]*root/); // $root never reaches a NAME (`:root {` is CSS)
  expect(sheet).not.toContain('undefined');
}, 30_000);

test('flat hand-off (no composition): corrected sets go in as plain sources', async () => {
  const files = { 'core.json': CORE };
  const tokens = parseCollection(files);
  const out = await terrazzoExporter.transform({
    base: tokens,
    variants: [],
    tokens,
    resolver: emptyResolver(),
    files,
    options: { plugins: [css()] },
  });
  const sheet = out.map((f) => f.content).join('\n');
  expect(sheet).toContain('--color-text:');
  expect(sheet).toMatch(/--hue:\s*0\.4/);
}, 30_000);

test('a dangling $ref fails terrazzo loudly (same contract as dangling aliases)', async () => {
  const files: Record<string, DtcgNode> = {
    'core.json': { broken: { $ref: '#/nope' } },
  };
  const tokens = parseCollection(files);
  await expect(
    terrazzoExporter.transform({
      base: tokens,
      variants: [],
      tokens,
      resolver: emptyResolver(),
      files,
      options: { plugins: [css()] },
    }),
  ).rejects.toThrow();
}, 30_000);
