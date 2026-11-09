import {
  createDocument,
  type DtcgNode,
  type ExporterInput,
  resolveExporterInput,
} from '@vertekum/core';
import { expect, test } from 'vitest';
import { figmaExporter } from './figma';
import type { FigmaModel } from './model';
import MODEL_SCHEMA from './model.schema.json';

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

test('a variable one brand lacks aliases NOT_AVAILABLE of its type in that brand’s modes', async () => {
  const m = await model(
    collection((files) => {
      const a = files['brand-a/light.json'] as Record<string, unknown>;
      a.teal = color(190); // brand-a only
      a.gutter = { $type: 'dimension', $value: { value: 12, unit: 'px' } };
    }),
  );
  const palette = m.collections.find((c) => c.name === 'palette');
  const teal = palette?.variables.find((v) => v.name === 'teal');
  const gutter = palette?.variables.find((v) => v.name === 'gutter');
  // brand-a keeps its value; brand-b's mode aliases the sentinel of the variable's type.
  expect(teal?.valuesByMode['brand-a']).toBeDefined();
  expect(teal?.alias).toEqual({ 'brand-b': 'NOT_AVAILABLE/COLOR' });
  expect(teal?.sources).toEqual({ 'brand-a': 'brand-a/light' });
  expect(gutter?.alias).toEqual({ 'brand-b': 'NOT_AVAILABLE/FLOAT' });

  // The sentinels exist — only the types used — and the marker names them.
  const sentinel = m.collections.find((c) => c.name === 'NOT_AVAILABLE');
  expect(sentinel?.modes).toEqual(['default']);
  expect(
    sentinel?.variables.map((v) => [v.name, v.valuesByMode.default]),
  ).toEqual([
    ['NOT_AVAILABLE/COLOR', { r: 1, g: 0, b: 1, a: 1 }],
    ['NOT_AVAILABLE/FLOAT', 0],
  ]);
  expect(m.source.notAvailable).toEqual({
    collection: 'NOT_AVAILABLE',
    variables: {
      COLOR: 'NOT_AVAILABLE/COLOR',
      FLOAT: 'NOT_AVAILABLE/FLOAT',
    },
  });
  expect(m.source.notices.join(' ')).toMatch(
    /2 variable\(s\) have no value in 'brand-b' — aliased to NOT_AVAILABLE/,
  );

  // Still a valid model.
  const AjvModule = await import('ajv/dist/2020.js');
  const Ajv = (AjvModule.default ?? AjvModule) as unknown as new (
    options: object,
  ) => {
    compile(
      schema: object,
    ): ((data: unknown) => boolean) & { errors?: unknown };
  };
  const validate = new Ajv({ strict: false }).compile(MODEL_SCHEMA);
  validate(m);
  expect(validate.errors ?? null).toBeNull();
});

test('no absences, no sentinels: no NOT_AVAILABLE collection and no marker', async () => {
  const m = await model(collection());
  expect(m.collections.some((c) => c.name === 'NOT_AVAILABLE')).toBe(false);
  expect(m.source.notAvailable).toBeUndefined();
});

/** The family moves into each brand's palette file: same name, a different family per brand. */
const familyPerBrand = (files: Record<string, DtcgNode>) => {
  const core = files['core.json'] as Record<string, unknown>;
  delete core.font;
  (files['brand-a/light.json'] as Record<string, unknown>).font = {
    sans: { $type: 'fontFamily', $value: ['Inter', 'sans-serif'] },
  };
  (files['brand-b/light.json'] as Record<string, unknown>).font = {
    sans: { $type: 'fontFamily', $value: ['Lora', 'serif'] },
  };
};

const body = (files: Record<string, DtcgNode>) =>
  (files['core.json'] as Record<string, { $value: Record<string, unknown> }>)
    .body as { $value: Record<string, unknown> };

test('a style whose brands differ only in a member it binds is shared, bound to the variable', async () => {
  const m = await model(collection(familyPerBrand));
  expect(m.styles.map((s) => s.name)).toEqual(['body']);
  expect(
    m.styles[0]?.properties.find((p) => p.property === 'font-family'),
  ).toEqual({
    property: 'font-family',
    value: 'Inter, sans-serif', // the first composition's plain value
    variable: 'font/sans',
  });
  expect(m.source.notices.join('\n')).not.toMatch(/style 'body'/);
});

test('a brand that overrides the typography token itself still splits the style', async () => {
  const m = await model(
    collection((files) => {
      familyPerBrand(files);
      (files['brand-b/light.json'] as Record<string, unknown>).body = {
        $type: 'typography',
        $value: { ...body(files).$value, fontWeight: 700 },
      };
    }),
  );
  expect(m.styles.map((s) => s.name).sort()).toEqual([
    'brand-a/body',
    'brand-b/body',
  ]);
  expect(m.source.notices.join('\n')).toMatch(
    /style 'body' differs between compositions/,
  );
});

test('a line height through a brand file is translated to px and bound, so the style is shared', async () => {
  const m = await model(
    collection((files) => {
      body(files).$value.lineHeight = '{leading.body}';
      (files['brand-a/light.json'] as Record<string, unknown>).leading = {
        body: { $type: 'number', $value: 1.5 },
      };
      (files['brand-b/light.json'] as Record<string, unknown>).leading = {
        body: { $type: 'number', $value: 1.6 },
      };
    }),
  );
  expect(m.styles.map((s) => s.name)).toEqual(['body']);
  expect(
    m.styles[0]?.properties.find((p) => p.property === 'line-height'),
  ).toEqual({
    property: 'line-height',
    value: '12px', // 8px × 1.5, the first composition's
    variable: 'leading/body',
  });
  const leading = m.collections
    .flatMap((c) => c.variables)
    .find((v) => v.name === 'leading/body');
  expect(Object.values(leading?.valuesByMode ?? {}).sort()).toEqual([12, 12.8]);
});

test('a line height whose size varies where its variable has no modes stays a multiplier', async () => {
  const m = await model(
    collection((files) => {
      body(files).$value.lineHeight = '{leading.body}';
      (files['core.json'] as Record<string, unknown>).leading = {
        body: { $type: 'number', $value: 1.5 },
      };
      // `space.gap` (the size) is overridden by the dark context: it varies by scheme, while
      // `leading.body` lives in a set collection with one mode.
      (files['brand-a/dark.json'] as Record<string, unknown>).space = {
        gap: { $type: 'dimension', $value: { value: 10, unit: 'px' } },
      };
    }),
    ['brand-a'],
  );
  const lineHeight = m.styles[0]?.properties.find(
    (p) => p.property === 'line-height',
  );
  expect(lineHeight?.value).toBe(1.5);
  expect(m.source.notices.join('\n')).toMatch(
    /'leading\.body' .*kept as a multiplier/,
  );
});

test('an em letter spacing never binds, so it splits too', async () => {
  const m = await model(
    collection((files) => {
      body(files).$value.letterSpacing = '{tracking.body}';
      for (const [brand, value] of [
        ['brand-a', 0.01],
        ['brand-b', 0.02],
      ] as const) {
        (files[`${brand}/light.json`] as Record<string, unknown>).tracking = {
          body: { $type: 'dimension', $value: { value, unit: 'em' } },
        };
      }
    }),
  );
  expect(m.styles.map((s) => s.name).sort()).toEqual([
    'brand-a/body',
    'brand-b/body',
  ]);
});

test('a member referencing a token with no variable names none, and still counts its chain', async () => {
  const m = await model(
    collection((files) => {
      body(files).$value.fontWeight = '{weight.curve}';
      for (const brand of ['brand-a', 'brand-b']) {
        (files[`${brand}/light.json`] as Record<string, unknown>).weight = {
          // A type with no Figma variable: the reference is materialized, never bound.
          curve: { $type: 'cubicBezier', $value: [0, 0, 1, 1] },
        };
      }
    }),
    ['brand-a'],
  );
  const weight = m.styles
    .find((s) => s.name === 'body')
    ?.properties.find((p) => p.property === 'font-weight');
  expect(weight?.variable).toBeUndefined();
});

/**
 * The semantic shape: each typography token is a group whose `$root` composite references one
 * child per property, and a brand's own theme file overrides only the child it changes.
 */
function semantic(edit?: (files: Record<string, DtcgNode>) => void) {
  const brand = (name: string) => ({
    version: '2025.10',
    sets: {
      core: { sources: [{ $ref: 'core.json' }] },
      theme: {
        sources: [{ $ref: 'theme.json' }, { $ref: `${name}/theme.json` }],
      },
    },
    resolutionOrder: [{ $ref: '#/sets/core' }, { $ref: '#/sets/theme' }],
  });
  const files: Record<string, DtcgNode> = {
    'core.json': {
      font: {
        sans: { $type: 'fontFamily', $value: ['Inter', 'sans-serif'] },
        size: {
          400: { $type: 'dimension', $value: { value: 16, unit: 'px' } },
          800: { $type: 'dimension', $value: { value: 56, unit: 'px' } },
        },
        weight: {
          regular: { $type: 'fontWeight', $value: 400 },
          bold: { $type: 'fontWeight', $value: 700 },
        },
        leading: { tight: { $type: 'number', $value: 1.2 } },
      },
    },
    'theme.json': {
      display: {
        $root: {
          $type: 'typography',
          $value: {
            fontFamily: '{display.family}',
            fontSize: '{display.size}',
            fontWeight: '{display.weight}',
            lineHeight: '{display.leading}',
            letterSpacing: '{display.tracking}',
          },
        },
        family: { $type: 'fontFamily', $value: '{font.sans}' },
        size: { $type: 'dimension', $value: '{font.size.800}' },
        weight: { $type: 'fontWeight', $value: '{font.weight.bold}' },
        leading: { $type: 'number', $value: 1.2143 },
        tracking: {
          $type: 'dimension',
          $value: { value: -0.56, unit: 'px' },
        },
      },
    },
    'brand-a/theme.json': {},
    'brand-b/theme.json': {},
    'brand-a.resolver.json': brand('brand-a'),
    'brand-b.resolver.json': brand('brand-b'),
  };
  edit?.(files);
  const document = createDocument();
  document.hydrate(files);
  return document;
}

const override = (
  files: Record<string, DtcgNode>,
  brand: string,
  child: string,
  token: Record<string, unknown>,
) => {
  const file = files[`${brand}/theme.json`] as Record<
    string,
    Record<string, unknown>
  >;
  file.display = { ...file.display, [child]: token };
};

const displayStyle = (m: FigmaModel) => {
  const style = m.styles.find((s) => s.name === 'display');
  return Object.fromEntries(
    (style?.properties ?? []).map((p) => [p.property, p]),
  );
};

const variableOf = (m: FigmaModel, name: string) =>
  m.collections.flatMap((c) => c.variables).find((v) => v.name === name);

test('semantic: a brand overriding a property child that aliases a primitive still shares the style', async () => {
  const m = await model(
    semantic((files) =>
      override(files, 'brand-b', 'weight', {
        $type: 'fontWeight',
        $value: '{font.weight.regular}',
      }),
    ),
  );
  expect(m.styles.map((s) => s.name)).toEqual(['display']);
  expect(m.source.notices.join('\n')).not.toMatch(/differs between/);
  const props = displayStyle(m);
  expect(props['font-family']?.variable).toBe('display/family');
  expect(props['font-size']?.variable).toBe('display/size');
  expect(props['font-weight']?.variable).toBe('display/weight');
  expect(props['letter-spacing']?.variable).toBe('display/tracking');
  expect(props['line-height']?.variable).toBe('display/leading');
});

test('semantic: an override holding the same value still shares the style', async () => {
  const m = await model(
    semantic((files) =>
      override(files, 'brand-b', 'weight', {
        $type: 'fontWeight',
        $value: '{font.weight.bold}',
      }),
    ),
  );
  expect(m.styles.map((s) => s.name)).toEqual(['display']);
});

test('semantic: a size child aliasing a dimension primitive binds, typed FLOAT', async () => {
  const m = await model(semantic());
  expect(displayStyle(m)['font-size']).toEqual({
    property: 'font-size',
    value: '56px',
    variable: 'display/size',
  });
  expect(variableOf(m, 'display/size')?.type).toBe('FLOAT');
  expect(variableOf(m, 'display/weight')?.type).toBe('FLOAT');
});

test('semantic: the line height is size × multiplier in px, rounded to 2 decimals, per brand', async () => {
  const m = await model(
    semantic((files) =>
      override(files, 'brand-b', 'leading', { $type: 'number', $value: 1.3 }),
    ),
  );
  expect(m.styles.map((s) => s.name)).toEqual(['display']);
  expect(displayStyle(m)['line-height']).toEqual({
    property: 'line-height',
    value: '68px', // 56 × 1.2143 = 68.0008
    variable: 'display/leading',
  });
  const leading = variableOf(m, 'display/leading');
  expect(leading?.type).toBe('FLOAT');
  expect(Object.values(leading?.valuesByMode ?? {}).sort()).toEqual([68, 72.8]);
  // The model still says what the token holds.
  expect(leading?.source).toEqual({ $type: 'number', $value: 1.2143 });
});

test('semantic: only the size differs — the line height still gets a px value per brand', async () => {
  const m = await model(
    semantic((files) =>
      override(files, 'brand-b', 'size', {
        $type: 'dimension',
        $value: '{font.size.400}',
      }),
    ),
  );
  expect(m.styles.map((s) => s.name)).toEqual(['display']);
  const leading = variableOf(m, 'display/leading');
  expect(Object.values(leading?.valuesByMode ?? {}).sort()).toEqual([
    19.43, 68,
  ]);
});

test('semantic: one line-height token under styles of different sizes stays a multiplier', async () => {
  const m = await model(
    semantic((files) => {
      const theme = files['theme.json'] as Record<string, unknown>;
      theme.caption = {
        $type: 'typography',
        $value: {
          fontFamily: '{font.sans}',
          fontSize: '{font.size.400}',
          fontWeight: 400,
          lineHeight: '{display.leading}',
        },
      };
    }),
  );
  expect(displayStyle(m)['line-height']).toEqual({
    property: 'line-height',
    value: 1.2143,
    variable: 'display/leading',
  });
  expect(
    Object.values(variableOf(m, 'display/leading')?.valuesByMode ?? {}),
  ).toContain(1.2143);
  expect(m.source.notices.join('\n')).toMatch(
    /'display\.leading' is the line height of styles with different font sizes/,
  );
});

test('semantic: a literal line height in the composite is left as it is', async () => {
  const m = await model(
    semantic((files) => {
      const theme = files['theme.json'] as Record<
        string,
        Record<string, { $value: Record<string, unknown> }>
      >;
      const root = theme.display?.$root;
      if (root) root.$value.lineHeight = 1.5;
    }),
  );
  expect(displayStyle(m)['line-height']).toEqual({
    property: 'line-height',
    value: 1.5,
  });
});

test('semantic: a line-height child aliasing a shared token is materialized, not an alias', async () => {
  const m = await model(
    semantic((files) => {
      const theme = files['theme.json'] as Record<
        string,
        Record<string, unknown>
      >;
      if (theme.display) {
        theme.display.leading = {
          $type: 'number',
          $value: '{font.leading.tight}',
        };
      }
    }),
  );
  const leading = variableOf(m, 'display/leading');
  expect(leading?.alias).toBeUndefined();
  expect(Object.values(leading?.valuesByMode ?? {})).toEqual(
    expect.arrayContaining([67.2]),
  );
});

test('semantic: the model is a valid draft.06 model', async () => {
  const m = await model(
    semantic((files) =>
      override(files, 'brand-b', 'leading', { $type: 'number', $value: 1.3 }),
    ),
  );
  expect(m.version).toBe('draft.06');
  const AjvModule = await import('ajv/dist/2020.js');
  const Ajv = (AjvModule.default ?? AjvModule) as unknown as new (
    options: object,
  ) => {
    compile(
      schema: object,
    ): ((data: unknown) => boolean) & { errors?: unknown };
  };
  const validate = new Ajv({ strict: false }).compile(MODEL_SCHEMA);
  validate(m);
  expect(validate.errors ?? null).toBeNull();
});

test('a reference that does not resolve in the composition is typed from its raw value, not thrown on', async () => {
  const m = await model(
    collection((files) => {
      (files['core.json'] as Record<string, unknown>).ghost = {
        $type: 'color',
        $value: '{not.defined}',
      };
    }),
    ['brand-a'],
  );
  expect(m.version).toBe('draft.06');
});
