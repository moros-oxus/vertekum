import { expect, test } from 'vitest';
import { type BuiltComposition, mergeModels } from './merge';
import type { FigmaCollection, FigmaModel, FigmaVariable } from './model';
import { MODEL_VERSION } from './model';

const variable = (
  name: string,
  valuesByMode: Record<string, unknown>,
): FigmaVariable => ({
  name,
  type: 'COLOR',
  valuesByMode,
  scopes: [],
  codeSyntax: {},
});

const model = (
  composition: string,
  collections: FigmaCollection[],
  styles: FigmaModel['styles'] = [],
): BuiltComposition => ({
  composition,
  model: {
    version: MODEL_VERSION,
    source: {
      compositions: [composition],
      generator: '@vertekum/ext-export-figma',
      notices: [],
    },
    collections,
    styles,
  },
});

const base = (value: string): FigmaCollection => ({
  name: 'base',
  modes: ['default'],
  variables: [variable('color/accent', { default: value })],
});

const colorMode = (
  light: string,
  dark: string,
  modes = ['light', 'dark'],
): FigmaCollection => ({
  name: 'color-mode',
  modes,
  variables: [variable('color/bg', { light, dark })],
});

test('a collection that resolves identically is left exactly as it is', () => {
  const merged = mergeModels([
    model('rexall', [base('red')]),
    model('lilly', [base('red')]),
  ]);
  const collection = merged.collections[0];
  expect(collection?.modes).toEqual(['default']);
  expect(collection?.modeSources).toBeUndefined();
  expect(merged.source.compositions).toEqual(['rexall', 'lilly']);
});

test('a single-mode collection that differs gains one mode per composition', () => {
  const merged = mergeModels(
    [model('rexall', [base('red')]), model('lilly', [base('blue')])],
    'figma',
  );
  const collection = merged.collections[0];
  expect(collection?.modes).toEqual(['rexall', 'lilly']);
  expect(collection?.variables[0]?.valuesByMode).toEqual({
    rexall: 'red',
    lilly: 'blue',
  });
  expect(collection?.modeSources?.rexall).toEqual({ composition: 'rexall' });
  expect(merged.source.target).toBe('figma');
});

test('a moded collection that differs takes (composition, context) pairs', () => {
  const merged = mergeModels([
    model('rexall', [colorMode('white', 'black')]),
    model('lilly', [colorMode('cream', 'ink')]),
  ]);
  const collection = merged.collections[0];
  expect(collection?.modes).toEqual([
    'rexall/light',
    'rexall/dark',
    'lilly/light',
    'lilly/dark',
  ]);
  expect(collection?.modeSources?.['lilly/dark']).toEqual({
    composition: 'lilly',
    context: 'dark',
  });
  expect(collection?.variables[0]?.valuesByMode['rexall/light']).toBe('white');
});

test('only pairs that exist become modes; the absence is a notice', () => {
  const merged = mergeModels([
    model('rexall', [colorMode('white', 'black')]),
    model('lilly', [
      {
        name: 'color-mode',
        modes: ['light'],
        variables: [variable('color/bg', { light: 'cream' })],
      },
    ]),
  ]);
  expect(merged.collections[0]?.modes).toEqual([
    'rexall/light',
    'rexall/dark',
    'lilly/light',
  ]);
  expect(merged.source.notices.join('\n')).toMatch(
    /'lilly' has no 'color-mode' context 'dark'/,
  );
});

test('a variable one composition lacks leaves its modes empty, with a notice', () => {
  const merged = mergeModels([
    model('rexall', [
      {
        name: 'base',
        modes: ['default'],
        variables: [
          variable('color/accent', { default: 'red' }),
          variable('color/brandOnly', { default: 'gold' }),
        ],
      },
    ]),
    model('lilly', [base('blue')]),
  ]);
  const brandOnly = merged.collections[0]?.variables.find(
    (v) => v.name === 'color/brandOnly',
  );
  expect(brandOnly?.valuesByMode).toEqual({ rexall: 'gold' });
  expect(brandOnly?.valuesByMode.lilly).toBeUndefined();
  expect(merged.source.notices.join('\n')).toMatch(
    /1 variable\(s\) have no value in 'lilly'/,
  );
});

test('a collection only one composition has is kept whole, with a notice', () => {
  const merged = mergeModels([
    model('rexall', [base('red'), colorMode('white', 'black')]),
    model('lilly', [base('red')]),
  ]);
  const density = merged.collections.find((c) => c.name === 'color-mode');
  expect(density?.modes).toEqual(['light', 'dark']);
  expect(merged.source.notices.join('\n')).toMatch(
    /collection 'color-mode' comes only from 'rexall'/,
  );
});

test('styles that differ are emitted per composition; identical ones are shared', () => {
  const style = (fontSize: string): FigmaModel['styles'][number] => ({
    kind: 'text',
    name: 'typography/body',
    properties: [{ property: 'font-size', value: fontSize }],
    source: { $type: 'typography', $value: {} },
  });
  const shared = mergeModels([
    model('rexall', [base('red')], [style('16px')]),
    model('lilly', [base('red')], [style('16px')]),
  ]);
  expect(shared.styles.map((s) => s.name)).toEqual(['typography/body']);

  const split = mergeModels([
    model('rexall', [base('red')], [style('16px')]),
    model('lilly', [base('red')], [style('18px')]),
  ]);
  expect(split.styles.map((s) => s.name)).toEqual([
    'rexall/typography/body',
    'lilly/typography/body',
  ]);
  expect(split.source.notices.join('\n')).toMatch(/style 'typography\/body'/);
});

test('one composition passes through untouched, stamped with its identity', () => {
  const merged = mergeModels([model('showcase', [base('red')])], 'figma');
  expect(merged.collections[0]).toEqual(base('red'));
  expect(merged.source).toMatchObject({
    target: 'figma',
    compositions: ['showcase'],
  });
});
