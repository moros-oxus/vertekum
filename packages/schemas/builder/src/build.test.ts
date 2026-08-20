import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { assertOpenSetsAreNameSets, build, type TreeNode } from './build';
import { emit, isStamped } from './emit';
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
  const resolved = resolveModule(join(dir, 'house.dfn'));
  const json = emit(build(resolved), { moduleFile: 'house.dfn' });
  const schema = JSON.parse(json);

  expect(isStamped(json)).toBe(true);
  expect(schema.$defs.emphasis.properties).toHaveProperty('subtle');
  expect(schema.$defs.emphasis.unevaluatedProperties).toBe(false);
  const text = schema.properties.color.properties.text;
  expect(text.properties.neutral).toEqual({ $ref: '#/$defs/emphasis' });
  expect(text.properties.brand).toEqual({ $ref: '#/$defs/emphasis' });
  expect(text.patternProperties).toEqual({ '^\\$': true });
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
  const resolved = resolveModule(join(dir, 'x.dfn'));
  const json = emit(build(resolved), {
    moduleFile: 'x.dfn',
    ...resolved.module.meta,
  });
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

test('scope "branch" leaves the document root unsealed', () => {
  const dir = fixture({
    'aspect.dfn': ['scope "branch"', 'root = color.brand', ''].join('\n'),
  });
  const resolved = resolveModule(join(dir, 'aspect.dfn'));
  const schema = JSON.parse(
    emit(build(resolved), {
      moduleFile: 'aspect.dfn',
      ...resolved.module.meta,
    }),
  );
  expect(schema.unevaluatedProperties).toBeUndefined();
  expect(schema.patternProperties).toEqual({ '^\\$': true });
  expect(schema.properties.color.unevaluatedProperties).toBe(false);
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
  const schema = JSON.parse(
    emit(build(resolveModule(join(dir, 'open.dfn'))), {
      moduleFile: 'open.dfn',
    }),
  );
  const color = schema.properties.color;
  expect(color.unevaluatedProperties).toBeUndefined();
  expect(color.additionalProperties.properties).toHaveProperty('subtle');
  expect(color.properties.primary.properties).toHaveProperty('bold');
});
