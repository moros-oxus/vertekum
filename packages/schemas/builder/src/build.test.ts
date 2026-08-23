import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { assertOpenSetsAreNameSets, build, type TreeNode } from './build';
import { buildModule } from './cli';
import { isStamped } from './emit';
import { parse } from './parser';
import { resolveModule } from './resolve';

function fixture(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'vtk-dfn-'));
  for (const [name, content] of Object.entries(files)) {
    const path = join(dir, name);
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, content);
  }
  return dir;
}

function names(node: TreeNode): string[] {
  return [...node.children.keys()];
}

test('ranges enumerate inclusively and union with literals, deduped', () => {
  const dir = fixture({
    'weight.dfn': 'root = font.[50 | 100-300/50 | 300-900/100 | 950]\n',
  });
  const tree = build(resolveModule(join(dir, 'weight.dfn')));
  expect(names(tree.children.get('font') as TreeNode)).toEqual([
    '50',
    '100',
    '150',
    '200',
    '250',
    '300',
    '400',
    '500',
    '600',
    '700',
    '800',
    '900',
    '950',
  ]);
});

test('scale terms: inferred padding, multiplied factors, quantization, collisions', () => {
  const dir = fixture({
    'pad.dfn': 'root = space.[0 | 025-100/25]\n',
    'double.dfn': 'root = size.25-400*2\n',
    'type.dfn': 'root = font.size.16-64*1.25~4\n',
    'coarse.dfn': 'root = x.10-16*1.1~4\n',
  });
  expect(
    names(
      build(resolveModule(join(dir, 'pad.dfn'))).children.get(
        'space',
      ) as TreeNode,
    ),
  ).toEqual(['0', '025', '050', '075', '100']);
  expect(
    names(
      build(resolveModule(join(dir, 'double.dfn'))).children.get(
        'size',
      ) as TreeNode,
    ),
  ).toEqual(['25', '50', '100', '200', '400']);
  expect(
    names(
      build(resolveModule(join(dir, 'type.dfn')))
        .children.get('font')
        ?.children.get('size') as TreeNode,
    ),
  ).toEqual(['16', '20', '24', '32', '40', '48', '60']);
  expect(() => build(resolveModule(join(dir, 'coarse.dfn')))).toThrowError(
    /quantum is too coarse/,
  );
});

test('branches give branch-dependent shape', () => {
  const dir = fixture({
    'house.dfn': [
      'emphasis = subtle | bold',
      'root = color.text.[neutral.<emphasis> | brand | success]',
      '',
    ].join('\n'),
  });
  const tree = build(resolveModule(join(dir, 'house.dfn')));
  const text = tree.children.get('color')?.children.get('text') as TreeNode;
  expect(names(text).sort()).toEqual(['brand', 'neutral', 'success']);
  expect(names(text.children.get('neutral') as TreeNode)).toEqual([
    'subtle',
    'bold',
  ]);
  expect(names(text.children.get('brand') as TreeNode)).toEqual([]);
});

test('? skips a slot: the syntagm lattice collapses through optional steps', () => {
  const dir = fixture({
    'lattice.dfn': [
      'role = brand | danger',
      'emphasis = subtle | bold',
      'root = color.<role>.<emphasis>?.hovered?',
      '',
    ].join('\n'),
  });
  const tree = build(resolveModule(join(dir, 'lattice.dfn')));
  const brand = tree.children.get('color')?.children.get('brand') as TreeNode;
  // role.<emphasis>.hovered, role.<emphasis>, role.hovered, role — all granted
  expect(names(brand).sort()).toEqual(['bold', 'hovered', 'subtle']);
  expect(names(brand.children.get('subtle') as TreeNode)).toEqual(['hovered']);
  expect(names(brand.children.get('hovered') as TreeNode)).toEqual([]);
});

test('set modifiers: ![…] omits, […] picks; a non-member in either is an error', () => {
  const dir = fixture({
    'sets.dfn': [
      'color-role = brand | danger | discovery | information | neutral | success | warning',
      'root = color.[background.<color-role ![brand, neutral]>.subtle | chart.<color-role [brand, neutral]>]',
      '',
    ].join('\n'),
    'typo.dfn': [
      'role = brand | neutral',
      'root = color.<role [brnad]>',
      '',
    ].join('\n'),
  });
  const tree = build(resolveModule(join(dir, 'sets.dfn')));
  const color = tree.children.get('color') as TreeNode;
  expect(names(color.children.get('background') as TreeNode).sort()).toEqual([
    'danger',
    'discovery',
    'information',
    'success',
    'warning',
  ]);
  expect(names(color.children.get('chart') as TreeNode).sort()).toEqual([
    'brand',
    'neutral',
  ]);
  expect(() => build(resolveModule(join(dir, 'typo.dfn')))).toThrowError(
    /no member 'brnad'/,
  );
});

test('use…as aliases an import: <@alias> is its root, <@alias/name> qualifies into it', () => {
  const dir = fixture({
    'palette/color.dfn': 'tone = light | dark\nroot = palette.<tone>\n',
    'color.dfn': [
      'use "./palette/color.dfn" as palette',
      'root = color.[<@palette> | <@palette/tone>]',
      '',
    ].join('\n'),
    'clash/color.dfn': 'x = a\n',
    'unaliased.dfn': [
      'use "./color.dfn"',
      'use "./clash/color.dfn"',
      'root = z.<@x>',
      '',
    ].join('\n'),
  });
  const tree = build(resolveModule(join(dir, 'color.dfn')));
  const color = tree.children.get('color') as TreeNode;
  expect(names(color.children.get('palette') as TreeNode)).toEqual([
    'light',
    'dark',
  ]);
  expect(names(color).sort()).toEqual(['dark', 'light', 'palette']);
  expect(() => resolveModule(join(dir, 'unaliased.dfn'))).toThrowError(
    /alias one: use "…" as other-name/,
  );
});

test('qualified refs resolve one import; unqualified collisions say how to qualify', () => {
  const dir = fixture({
    'warm.dfn': 'tone = red | orange\n',
    'cool.dfn': 'tone = blue | teal\n',
    'mix.dfn': [
      'use "./warm.dfn"',
      'use "./cool.dfn"',
      'root = color.[warm.<@warm/tone> | cool.<@cool/tone>]',
      '',
    ].join('\n'),
    'clash.dfn': [
      'use "./warm.dfn"',
      'use "./cool.dfn"',
      'root = color.<@tone>',
      '',
    ].join('\n'),
    'wrong.dfn': ['use "./warm.dfn"', 'root = color.<@warm/hue>', ''].join(
      '\n',
    ),
  });
  const tree = build(resolveModule(join(dir, 'mix.dfn')));
  const color = tree.children.get('color') as TreeNode;
  expect(names(color.children.get('warm') as TreeNode)).toEqual([
    'red',
    'orange',
  ]);
  expect(names(color.children.get('cool') as TreeNode)).toEqual([
    'blue',
    'teal',
  ]);
  expect(() => build(resolveModule(join(dir, 'clash.dfn')))).toThrowError(
    /qualify it: <@module\/tone>/,
  );
  expect(() => build(resolveModule(join(dir, 'wrong.dfn')))).toThrowError(
    /'warm' has no production 'hue'/,
  );
  expect(() => parse('root = <a/b>\n')).toThrowError(/write <@module\/name>/);
});

test('imports resolve relatively; <@name> finds a production, module name finds a root', () => {
  const dir = fixture({
    'conspicuity.dfn': 'conspicuity = subtle | normal | bold\n',
    'color.dfn': [
      'use "./conspicuity.dfn"',
      'property = background | text',
      'root = color.<property>.<@conspicuity>',
      '',
    ].join('\n'),
    'schema.dfn': ['use "./color.dfn"', 'root = <@color>', ''].join('\n'),
  });
  const tree = build(resolveModule(join(dir, 'schema.dfn')));
  const bg = tree.children.get('color')?.children.get('background') as TreeNode;
  expect(names(bg)).toEqual(['subtle', 'normal', 'bold']);
});

test('open sets admit additions with the shared tail; open on sub-paths is refused', () => {
  const dir = fixture({
    'open.dfn': [
      'role = primary | secondary',
      'root = color.<role*>.[subtle | bold]',
      '',
    ].join('\n'),
    'bad.dfn': 'root = color.[a.x | b.y *]\n',
  });
  const resolved = resolveModule(join(dir, 'open.dfn'));
  assertOpenSetsAreNameSets(resolved);
  const tree = build(resolved);
  const colorNode = tree.children.get('color') as TreeNode;
  expect(colorNode.open).toBe(true);

  const bad = resolveModule(join(dir, 'bad.dfn'));
  expect(() => assertOpenSetsAreNameSets(bad)).toThrowError(/opens a set/);
});

test('aggregate top-level collisions, import cycles, and ref cycles are errors', () => {
  const dir = fixture({
    'a.dfn': 'root = shared.x\n',
    'b.dfn': 'root = shared.y\n',
    'agg.dfn': [
      'use "./a.dfn"',
      'use "./b.dfn"',
      'root = [<@a> | <@b>]',
      '',
    ].join('\n'),
    'cyc1.dfn': 'use "./cyc2.dfn"\nroot = x\n',
    'cyc2.dfn': 'use "./cyc1.dfn"\nroot = y\n',
    'self.dfn': 'a = <b>\nb = <a>\nroot = x.<a>\n',
  });
  expect(() => build(resolveModule(join(dir, 'agg.dfn')))).toThrowError(
    /top-level 'shared'/,
  );
  expect(() => resolveModule(join(dir, 'cyc1.dfn'))).toThrowError(/cycle/);
  expect(() => build(resolveModule(join(dir, 'self.dfn')))).toThrowError(
    /expands through itself/,
  );
});

test('a package-specifier import resolves: @vertekum/schema-vocabulary/color-role.dfn', () => {
  // Package resolution walks up from the importing module's own directory, so the module must
  // sit where this package's node_modules (holding the devDep link) is reachable.
  const here = join(import.meta.dirname, 'bg.tmp.dfn');
  writeFileSync(
    here,
    [
      'use "@vertekum/schema-vocabulary/color-role.dfn"',
      'root = color.background.<@color-role>',
      '',
    ].join('\n'),
  );
  try {
    const tree = build(resolveModule(here));
    const bg = tree.children
      .get('color')
      ?.children.get('background') as TreeNode;
    expect(names(bg).sort()).toEqual([
      'brand',
      'danger',
      'discovery',
      'information',
      'neutral',
      'success',
      'warning',
    ]);
  } finally {
    rmSync(here);
  }
});

test('emission reproduces the hand-written house.json shape from three lines', () => {
  const dir = fixture({
    'house.dfn': [
      'emphasis = subtle | bold',
      'root = color.text.[neutral.<emphasis> | brand.<emphasis> | success.<emphasis>]',
      '',
    ].join('\n'),
  });
  const { content: json } = buildModule(join(dir, 'house.dfn'));
  const schema = JSON.parse(json);

  expect(isStamped(json)).toBe(true);
  // A pattern def is OPEN at its top — sealing belongs to the positions that apply it.
  expect(schema.$defs.emphasis.properties).toHaveProperty('subtle');
  expect(schema.$defs.emphasis.unevaluatedProperties).toBeUndefined();
  expect(schema.$defs.emphasis.properties.subtle).toEqual({
    $ref: '#/$defs/terminal',
  });
  expect(schema.$defs.terminal.unevaluatedProperties).toBe(false);
  const text = schema.properties.color.properties.text;
  expect(text.properties.neutral).toEqual({
    allOf: [{ $ref: '#/$defs/emphasis' }],
    type: 'object',
    patternProperties: { '^\\$': true },
    unevaluatedProperties: false,
  });
  expect(text.properties.brand.allOf).toEqual([{ $ref: '#/$defs/emphasis' }]);
  expect(text.unevaluatedProperties).toBe(false);
});

test('pragmas surface in the emitted document, $id before the stamp', () => {
  const dir = fixture({
    'x.dfn': [
      'id "vertekum://example/x.json"',
      'title "X"',
      'description "The x vocabulary."',
      'root = x.a',
      '',
    ].join('\n'),
  });
  const { content: json } = buildModule(join(dir, 'x.dfn'));
  const keys = Object.keys(JSON.parse(json));
  expect(keys.slice(0, 5)).toEqual([
    '$schema',
    '$id',
    '$comment',
    'title',
    'description',
  ]);
  expect(JSON.parse(json).$id).toBe('vertekum://example/x.json');
});

test('sealed "false" leaves the document root unsealed; scope "branch" still parses as its alias', () => {
  for (const pragma of ['sealed "false"', 'scope "branch"']) {
    const dir = fixture({
      'aspect.dfn': [pragma, 'root = color.brand', ''].join('\n'),
    });
    const schema = JSON.parse(buildModule(join(dir, 'aspect.dfn')).content);
    expect(schema.unevaluatedProperties).toBeUndefined();
    expect(schema.patternProperties).toEqual({ '^\\$': true });
    expect(schema.properties.color.unevaluatedProperties).toBe(false);
  }
});

test('a package exports map remaps flat .dfn specifiers into folders', () => {
  const dir = fixture({
    'node_modules/fake-schemas/package.json': `${JSON.stringify({
      name: 'fake-schemas',
      version: '0.0.0',
      exports: {
        './*.dfn': './dfn/*.dfn',
        './package.json': './package.json',
      },
    })}\n`,
    'node_modules/fake-schemas/dfn/x.dfn': 'x = a | b\n',
    'main.dfn': ['use "fake-schemas/x.dfn"', 'root = top.<@x>', ''].join('\n'),
  });
  const tree = build(resolveModule(join(dir, 'main.dfn')));
  expect(names(tree.children.get('top') as TreeNode)).toEqual(['a', 'b']);
});

test('an open position emits additionalProperties with the shared tail, no closure', () => {
  const dir = fixture({
    'open.dfn': [
      'role = primary | secondary',
      'root = color.<role*>.[subtle | bold]',
      '',
    ].join('\n'),
  });
  const schema = JSON.parse(buildModule(join(dir, 'open.dfn')).content);
  const color = schema.properties.color;
  expect(color.unevaluatedProperties).toBeUndefined();
  expect(color.additionalProperties.properties).toHaveProperty('subtle');
  expect(color.properties.primary.properties).toHaveProperty('bold');
});

test('affixed scales build the wrapped names', () => {
  const dir = fixture({
    't-shirt.dfn':
      'root = size.[(2-4)xs | small | medium | large | x(2-8/2)l | (02-04/2)huge]\n',
  });
  const tree = build(resolveModule(join(dir, 't-shirt.dfn')));
  expect(names(tree.children.get('size') as TreeNode)).toEqual([
    '2xs',
    '3xs',
    '4xs',
    'small',
    'medium',
    'large',
    'x2l',
    'x4l',
    'x6l',
    'x8l',
    '02huge',
    '04huge',
  ]);
});

test('linked emission: an unmodified root embedding $refs the child artifact', () => {
  const dir = fixture({
    'primitives.dfn':
      'use "./primitives/color.dfn"\n\nroot = [<@color> | space.[100 | 200]]\n',
    'primitives/color.dfn': 'root = color.[base | subtle]\n',
  });
  const linked = buildModule(join(dir, 'primitives.dfn'), {
    linkResolve: (child) => `./primitives/${child.name}.json`,
  }).content;
  const parsed = JSON.parse(linked);
  expect(parsed.properties.color).toEqual({
    $ref: './primitives/color.json#/properties/color',
  });
  expect(parsed.properties.space.properties['100']).toBeDefined();

  // Without linkResolve the same tree inlines — the tag is inert.
  const inline = JSON.parse(buildModule(join(dir, 'primitives.dfn')).content);
  expect(inline.properties.color.properties.base).toBeDefined();
});

test('linked emission: modified, tailed, and production refs stay inline', () => {
  const dir = fixture({
    'parent.dfn': [
      'use "./child.dfn"',
      '',
      'root = [t.<@child>.suffix | picked.<@child/size [sm]> | <@child ![color]>]',
      '',
    ].join('\n'),
    'child.dfn': 'size = sm | md\nroot = [color.base | extra.thing]\n',
  });
  const linked = JSON.parse(
    buildModule(join(dir, 'parent.dfn'), {
      linkResolve: () => './child.json',
    }).content,
  );
  expect(JSON.stringify(linked)).not.toContain('child.json');
});

test('privacy: local refs resolve, importers are refused with the public listing', () => {
  const dir = fixture({
    'mydef.dfn': [
      ':hidden = five',
      'named = <hidden> | one | two',
      'root = <named>',
      '',
    ].join('\n'),
    'consumer.dfn': ['use "./mydef.dfn"', 'root = t.<@mydef/hidden>', ''].join(
      '\n',
    ),
  });
  const mine = JSON.parse(buildModule(join(dir, 'mydef.dfn')).content);
  expect(Object.keys(mine.$defs)).toContain('named');
  expect(Object.keys(mine.$defs)).not.toContain('hidden');

  expect(() => buildModule(join(dir, 'consumer.dfn'))).toThrow(
    /'hidden' is private to mydef\.dfn — its public productions: <@mydef\/named>/,
  );
});

test('the def-scope dual form: patterns compose, the body applies the filename def', () => {
  const dir = fixture({
    'mydef.dfn': [
      'scope "def"',
      '',
      'named-even = two | four',
      'named-odd = one | three',
      ':named-five = five',
      'root = <named-even> | <named-odd> | <named-five>',
      '',
    ].join('\n'),
  });
  const schema = JSON.parse(buildModule(join(dir, 'mydef.dfn')).content);

  // Patterns are open at the top; the root def composes them and inlines the private.
  expect(schema.$defs['named-even'].unevaluatedProperties).toBeUndefined();
  expect(schema.$defs.root.allOf).toEqual([
    { $ref: '#/$defs/named-even' },
    { $ref: '#/$defs/named-odd' },
  ]);
  expect(schema.$defs.root.properties).toHaveProperty('five');
  // The body applies the def — pattern-natured: UNSEALED unless the author seals it,
  // so a consumer can whole-file-compose the module beside siblings.
  expect(schema.allOf).toEqual([{ $ref: '#/$defs/root' }]);
  expect(schema.unevaluatedProperties).toBeUndefined();
  expect(schema.properties).toBeUndefined();
});

test('a merge that grows a pattern member drops the ref back to expansion', () => {
  const dir = fixture({
    'grown.dfn': ['set = a | b', 'root = top.[<set> | a.extra]', ''].join('\n'),
  });
  const schema = JSON.parse(buildModule(join(dir, 'grown.dfn')).content);
  const top = schema.properties.top;
  // `a` gained a child beyond the pattern — the position expands instead of $ref'ing.
  expect(top.allOf).toBeUndefined();
  expect(top.properties.a.properties).toHaveProperty('extra');
  expect(top.properties.b).toBeDefined();
});

test('the Tamblyn shape: one scale pattern, referenced from every member', () => {
  const dir = fixture({
    'color.dfn': [
      'saturated = red | blue',
      'neutral = white | black',
      'scale = [ 50 | 100-200/100 ]',
      'root = color.[ <saturated> | <neutral> ].<scale>',
      '',
    ].join('\n'),
  });
  const schema = JSON.parse(buildModule(join(dir, 'color.dfn')).content);
  const color = schema.properties.color;
  for (const member of ['red', 'blue', 'white', 'black']) {
    expect(color.properties[member].allOf).toEqual([{ $ref: '#/$defs/scale' }]);
  }
  // The group wrapper no longer defeats set recognition (isNameSet recurses).
  expect(Object.keys(schema.$defs.scale.properties)).toEqual([
    '50',
    '100',
    '200',
  ]);
});

test('schemaId derives the $id when no pragma id exists', () => {
  const dir = fixture({ 'x.dfn': 'root = x.a\n' });
  const { content } = buildModule(join(dir, 'x.dfn'), {
    schemaId: 'https://example.org/schemas/x.json',
  });
  expect(JSON.parse(content).$id).toBe('https://example.org/schemas/x.json');
});

test('a def module: sealed "true" opts the body in; consumers reference the FILE', () => {
  const dir = fixture({
    'color.dfn': [
      'scope "def"',
      'sealed "true"',
      'root = color.[base | subtle]',
      '',
    ].join('\n'),
    'primitives.dfn': [
      'use "./color.dfn"',
      'root = [<@color> | space.[100 | 200]]',
      '',
    ].join('\n'),
  });
  const child = JSON.parse(buildModule(join(dir, 'color.dfn')).content);
  expect(child.unevaluatedProperties).toBe(false);

  const parent = JSON.parse(
    buildModule(join(dir, 'primitives.dfn'), {
      linkResolve: (m) => `./${m.name}.json`,
    }).content,
  );
  // A SEALED def file cannot be whole-file-composed — the pointer reaches its
  // unsealed root def instead.
  expect(parent.allOf).toEqual([{ $ref: './color.json#/$defs/root' }]);
  expect(parent.properties.color).toBeUndefined();
  expect(parent.properties.space).toBeDefined();
  expect(parent.unevaluatedProperties).toBe(false);
});

test('an unsealed def module composes as the whole file', () => {
  const dir = fixture({
    'color.dfn': ['scope "def"', 'root = color.[base | subtle]', ''].join('\n'),
    'primitives.dfn': [
      'use "./color.dfn"',
      'root = [<@color> | space.[100 | 200]]',
      '',
    ].join('\n'),
  });
  const parent = JSON.parse(
    buildModule(join(dir, 'primitives.dfn'), {
      linkResolve: (m) => `./${m.name}.json`,
    }).content,
  );
  expect(parent.allOf).toEqual([{ $ref: './color.json' }]);
});
