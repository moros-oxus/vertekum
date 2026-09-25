import {
  createDocument,
  type DtcgNode,
  type ExporterInput,
  resolveExporterInput,
} from '@vertekum/core';
import { expect, test } from 'vitest';
import { figmaExporter } from './figma';
import type { FigmaModel } from './model';

/**
 * The model's STRUCTURE comes from the resolvers — which file defines a path, which resolver entry
 * references that file — and never from values. Built from a real parsed collection (as `build`
 * does), because a hand-made fixture can fake what only files decide.
 *
 * Two brands, the override pattern (an empty default context; `dark` overrides palette paths), a
 * shared core, and — by default — IDENTICAL values everywhere: the case a value-based rule gets
 * wrong.
 */
const color = (hue: number) => ({
  $type: 'color',
  $value: { colorSpace: 'oklch', components: [0.6, 0.1, hue], alpha: 1 },
});

function collection(edit?: (files: Record<string, DtcgNode>) => void) {
  const brand = (name: string) => ({
    version: '2025.10',
    sets: {
      core: { sources: [{ $ref: 'core.json' }] },
      palette: { sources: [{ $ref: `${name}/light.json` }] },
    },
    modifiers: {
      scheme: {
        default: 'light',
        contexts: { light: [], dark: [{ $ref: `${name}/dark.json` }] },
      },
    },
    resolutionOrder: [
      { $ref: '#/sets/core' },
      { $ref: '#/sets/palette' },
      { $ref: '#/modifiers/scheme' },
    ],
  });
  const files: Record<string, DtcgNode> = {
    'core.json': {
      space: { gap: { $type: 'dimension', $value: { value: 8, unit: 'px' } } },
      text: { $type: 'color', $value: '{steel}' },
      font: { sans: { $type: 'fontFamily', $value: ['Inter', 'sans-serif'] } },
      body: {
        $type: 'typography',
        $value: {
          fontFamily: '{font.sans}',
          fontSize: '{space.gap}',
          fontWeight: 400,
          lineHeight: 1.5,
        },
      },
    },
    'brand-a/light.json': {
      steel: { $root: color(250), 100: color(250) },
      mist: color(200),
    },
    'brand-a/dark.json': { mist: color(200) },
    'brand-b/light.json': {
      steel: { $root: color(250), 100: color(250) },
      mist: color(200),
    },
    'brand-b/dark.json': { mist: color(200) },
    'brand-a.resolver.json': brand('brand-a'),
    'brand-b.resolver.json': brand('brand-b'),
  };
  edit?.(files);
  const document = createDocument();
  document.hydrate(files);
  return document;
}

async function model(
  document: ReturnType<typeof createDocument>,
  compositions = ['brand-a', 'brand-b'],
): Promise<FigmaModel> {
  const tokens = document.getAllTokens();
  const resolved = compositions.map((name) => {
    const resolver = document.getResolvers().get(name);
    if (!resolver) throw new Error(`no ${name}`);
    const { base, variants } = resolveExporterInput(resolver, tokens);
    return { name, base, variants, resolver };
  });
  const [first] = resolved;
  const input: ExporterInput = {
    base: first?.base ?? [],
    variants: first?.variants ?? [],
    resolver: first?.resolver as ExporterInput['resolver'],
    tokens,
    target: 'figma',
    ...(compositions.length > 1 ? { compositions: resolved } : {}),
  };
  const [file] = await figmaExporter.transform(input);
  return JSON.parse(file?.content ?? '{}') as FigmaModel;
}

const shape = (m: FigmaModel) =>
  m.collections.map((c) => ({
    name: c.name,
    modes: c.modes,
    variables: c.variables.map((v) => v.name).sort(),
  }));

test('a modifier owns what its context files define — even while the values are identical', async () => {
  const m = await model(collection(), ['brand-a']);
  const scheme = m.collections.find((c) => c.name === 'scheme');
  expect(scheme?.modes).toEqual(['light', 'dark']);
  expect(scheme?.variables.map((v) => v.name)).toEqual(['mist']);
  // …and the set keeps the rest.
  expect(
    m.collections
      .find((c) => c.name === 'palette')
      ?.variables.map((v) => v.name),
  ).toEqual(['steel', 'steel/100']);
});

test('across compositions: same files → shared, different files → a mode per composition', async () => {
  const m = await model(collection());
  expect(shape(m)).toEqual([
    {
      name: 'core',
      modes: ['default'],
      variables: ['font/sans', 'space/gap', 'text'],
    },
    {
      name: 'palette',
      modes: ['brand-a', 'brand-b'],
      variables: ['steel', 'steel/100'],
    },
    {
      name: 'scheme',
      modes: ['brand-a/light', 'brand-a/dark', 'brand-b/light', 'brand-b/dark'],
      variables: ['mist'],
    },
  ]);
});

test('value edits never move the structure — only the fingerprint', async () => {
  const before = await model(collection());
  const after = await model(
    collection((files) => {
      (files['brand-a/dark.json'] as Record<string, unknown>).mist = color(20);
      (files['brand-b/light.json'] as Record<string, unknown>).steel = {
        $root: color(10),
        100: color(10),
      };
    }),
  );
  expect(shape(after)).toEqual(shape(before));
  expect(after.source.fingerprint).not.toBe(before.source.fingerprint);
  expect(after.source.fingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);
});

test('the fingerprint is content only — notices and generator never change it', async () => {
  const m = await model(collection());
  const again = await model(collection());
  expect(again.source.fingerprint).toBe(m.source.fingerprint);
});

test("$root never reaches a name: the group's own value is named by the group", async () => {
  const m = await model(collection(), ['brand-a']);
  const names = m.collections.flatMap((c) => c.variables.map((v) => v.name));
  expect(names).toContain('steel');
  expect(names.some((n) => n.includes('$root'))).toBe(false);
  // …and an alias to it targets that name.
  const text = m.collections
    .find((c) => c.name === 'core')
    ?.variables.find((v) => v.name === 'text');
  expect(text?.alias?.default).toBe('steel');
});

test('sources name the file each mode came from', async () => {
  const m = await model(collection());
  const mist = m.collections
    .find((c) => c.name === 'scheme')
    ?.variables.find((v) => v.name === 'mist');
  expect(mist?.sources).toEqual({
    'brand-a/light': 'brand-a/light',
    'brand-a/dark': 'brand-a/dark',
    'brand-b/light': 'brand-b/light',
    'brand-b/dark': 'brand-b/dark',
  });
});

test('a modifier that overrides nothing emits no collection, and says so', async () => {
  const m = await model(
    collection((files) => {
      files['brand-a/dark.json'] = {};
    }),
    ['brand-a'],
  );
  expect(m.collections.map((c) => c.name)).toEqual(['core', 'palette']);
  expect(m.source.notices).toContain(
    "modifier 'scheme' overrides nothing here — no collection emitted for it",
  );
});

test('a style member authored as a reference carries the VALUE, and the binding', async () => {
  const m = await model(collection(), ['brand-a']);
  const body = m.styles.find((st) => st.name === 'body');
  const family = body?.properties.find((p) => p.property === 'font-family');
  expect(family).toEqual({
    property: 'font-family',
    value: 'Inter, sans-serif',
    variable: 'font/sans',
  });
  expect(body?.properties.find((p) => p.property === 'font-size')?.value).toBe(
    '8px',
  );
});
