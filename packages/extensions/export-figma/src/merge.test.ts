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
    model('acme', [base('red')]),
    model('globex', [base('red')]),
  ]);
  const collection = merged.collections[0];
  expect(collection?.modes).toEqual(['default']);
  expect(collection?.modeSources).toBeUndefined();
  expect(merged.source.compositions).toEqual(['acme', 'globex']);
});

test('a single-mode collection that differs gains one mode per composition', () => {
  const merged = mergeModels(
    [model('acme', [base('red')]), model('globex', [base('blue')])],
    'figma',
  );
  const collection = merged.collections[0];
  expect(collection?.modes).toEqual(['acme', 'globex']);
  expect(collection?.variables[0]?.valuesByMode).toEqual({
    acme: 'red',
    globex: 'blue',
  });
  expect(collection?.modeSources?.acme).toEqual({ composition: 'acme' });
  expect(merged.source.target).toBe('figma');
});

test('a moded collection that differs takes (composition, context) pairs', () => {
  const merged = mergeModels([
    model('acme', [colorMode('white', 'black')]),
    model('globex', [colorMode('cream', 'ink')]),
  ]);
  const collection = merged.collections[0];
  expect(collection?.modes).toEqual([
    'acme/light',
    'acme/dark',
    'globex/light',
    'globex/dark',
  ]);
  expect(collection?.modeSources?.['globex/dark']).toEqual({
    composition: 'globex',
    context: 'dark',
  });
  expect(collection?.variables[0]?.valuesByMode['acme/light']).toBe('white');
});

test('only pairs that exist become modes; the absence is a notice', () => {
  const merged = mergeModels([
    model('acme', [colorMode('white', 'black')]),
    model('globex', [
      {
        name: 'color-mode',
        modes: ['light'],
        variables: [variable('color/bg', { light: 'cream' })],
      },
    ]),
  ]);
  expect(merged.collections[0]?.modes).toEqual([
    'acme/light',
    'acme/dark',
    'globex/light',
  ]);
  expect(merged.source.notices.join('\n')).toMatch(
    /'globex' has no 'color-mode' context 'dark'/,
  );
});

test('a variable one composition lacks leaves its modes empty, with a notice', () => {
  const merged = mergeModels([
    model('acme', [
      {
        name: 'base',
        modes: ['default'],
        variables: [
          variable('color/accent', { default: 'red' }),
          variable('color/brandOnly', { default: 'gold' }),
        ],
      },
    ]),
    model('globex', [base('blue')]),
  ]);
  const brandOnly = merged.collections[0]?.variables.find(
    (v) => v.name === 'color/brandOnly',
  );
  expect(brandOnly?.valuesByMode).toEqual({ acme: 'gold' });
  expect(brandOnly?.valuesByMode.globex).toBeUndefined();
  expect(merged.source.notices.join('\n')).toMatch(
    /1 variable\(s\) have no value in 'globex'/,
  );
});

test('a collection only one composition has is kept whole, with a notice', () => {
  const merged = mergeModels([
    model('acme', [base('red'), colorMode('white', 'black')]),
    model('globex', [base('red')]),
  ]);
  const density = merged.collections.find((c) => c.name === 'color-mode');
  expect(density?.modes).toEqual(['light', 'dark']);
  expect(merged.source.notices.join('\n')).toMatch(
    /collection 'color-mode' comes only from 'acme'/,
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
    model('acme', [base('red')], [style('16px')]),
    model('globex', [base('red')], [style('16px')]),
  ]);
  expect(shared.styles.map((s) => s.name)).toEqual(['typography/body']);

  const split = mergeModels([
    model('acme', [base('red')], [style('16px')]),
    model('globex', [base('red')], [style('18px')]),
  ]);
  expect(split.styles.map((s) => s.name)).toEqual([
    'acme/typography/body',
    'globex/typography/body',
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
