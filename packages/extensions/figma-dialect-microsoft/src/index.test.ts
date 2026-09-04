import type { FigmaModel } from '@vertekum/ext-export-figma';
import { expect, test } from 'vitest';
import { microsoftManifest } from './index';

const model: FigmaModel = {
  version: 1,
  source: { composition: 'brand-a', generator: 'test', notices: [] },
  collections: [
    {
      name: 'base',
      modes: ['default'],
      variables: [
        {
          name: 'space/gap',
          type: 'FLOAT',
          valuesByMode: { default: 8 },
          scopes: [],
          codeSyntax: {},
        },
        {
          name: 'color/text',
          type: 'COLOR',
          valuesByMode: { default: { r: 1, g: 0, b: 0, a: 1 } },
          alias: { default: 'color/accent' },
          scopes: [],
          codeSyntax: {},
        },
      ],
    },
    {
      name: 'color-mode',
      modes: ['light', 'dark'],
      variables: [
        {
          name: 'color/accent',
          type: 'COLOR',
          valuesByMode: {
            light: { r: 1, g: 0, b: 0, a: 1 },
            dark: { r: 0, g: 0, b: 1, a: 0.5 },
          },
          scopes: [],
          codeSyntax: {},
        },
      ],
    },
  ],
  styles: [
    {
      kind: 'text',
      name: 'typography/body',
      properties: [
        { property: 'font-size', value: '16px' },
        { property: 'font-weight', value: 400, variable: 'font/regular' },
      ],
      source: { $type: 'typography', $value: {} },
    },
  ],
};

const parse = (
  files: Array<{ path: string; content: string }>,
  path: string,
): Record<string, unknown> => {
  const file = files.find((f) => f.path === path);
  if (!file) throw new Error(`missing ${path}: ${files.map((f) => f.path)}`);
  return JSON.parse(file.content);
};

test('native: file per collection-mode, hex/alias downgrade, styles flattened', () => {
  const files = microsoftManifest().write(model);
  const manifest = parse(files, 'manifest.json') as {
    collections: Record<string, { modes: Record<string, string[]> }>;
  };
  expect(Object.keys(manifest.collections)).toEqual(['base', 'color-mode']);
  expect(manifest.collections['color-mode']?.modes).toEqual({
    light: ['color-mode.light.tokens.json'],
    dark: ['color-mode.dark.tokens.json'],
  });

  const dark = parse(files, 'color-mode.dark.tokens.json') as {
    color: { accent: { $type: string; $value: string } };
  };
  expect(dark.color.accent.$value).toBe('#0000ff80');

  const base = parse(files, 'base.default.tokens.json') as {
    color: { text: { $value: string } };
    space: { gap: { $type: string; $value: number } };
    typography: { body: Record<string, { $value: unknown }> };
  };
  // Alias wins over the value; the reference spelling is the importer's own.
  expect(base.color.text.$value).toBe('{color.accent}');
  expect(base.space.gap.$value).toBe(8);
  // The importer cannot create styles, so nothing is dropped: per-property variables.
  expect(base.typography.body['font-size']?.$value).toBe('16px');
  expect(base.typography.body['font-weight']?.$value).toBe('{font.regular}');
});

test('split-collections: each context becomes a sibling single-mode collection', () => {
  const files = microsoftManifest({ modes: 'split-collections' }).write(model);
  const manifest = parse(files, 'manifest.json') as {
    collections: Record<string, { modes: Record<string, string[]> }>;
  };
  expect(Object.keys(manifest.collections)).toEqual([
    'base',
    'color-mode/light',
    'color-mode/dark',
  ]);
  for (const entry of Object.values(manifest.collections)) {
    expect(Object.keys(entry.modes)).toEqual(['default']);
  }
});

test('split-files: one manifest per context, base collections in each', () => {
  const files = microsoftManifest({ modes: 'split-files' }).write(model);
  const light = parse(files, 'manifest.color-mode.light.json') as {
    collections: Record<string, { modes: Record<string, string[]> }>;
  };
  const dark = parse(files, 'manifest.color-mode.dark.json') as {
    collections: Record<string, { modes: Record<string, string[]> }>;
  };
  expect(Object.keys(light.collections)).toEqual(['base', 'color-mode']);
  expect(light.collections['color-mode']?.modes.default).toEqual([
    'color-mode.light.tokens.json',
  ]);
  expect(dark.collections['color-mode']?.modes.default).toEqual([
    'color-mode.dark.tokens.json',
  ]);
});
