import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { assertOpenSetsAreNameSets, build, type TreeNode } from './build';
import { emit, isStamped } from './emit';
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

test('branches give branch-dependent shape; ? changes nothing in v1', () => {
  const dir = fixture({
    'house.dfn': [
      'emphasis = subtle | bold',
      'root = color.text.[neutral.<emphasis>? | brand | success]',
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
