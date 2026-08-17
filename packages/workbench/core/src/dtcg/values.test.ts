import { expect, test } from 'vitest';
import {
  COLOR_SPACES,
  convertColor,
  parseValueInput,
  renderCssValue,
} from './values';

test('hex → oklch object, byte-deterministic', async () => {
  expect(await parseValueInput('color', '#ff00ff')).toEqual({
    colorSpace: 'oklch',
    components: [0.7017, 0.3225, 328.3634],
    alpha: 1,
    hex: '#ff00ff',
  });
});

test('css functions, named colours, alpha, target space', async () => {
  const srgb = (await parseValueInput('color', 'rgb(255 0 255 / 0.5)', {
    colorSpace: 'srgb',
  })) as {
    colorSpace: string;
    components: number[];
    alpha: number;
    hex: string;
  };
  expect(srgb.colorSpace).toBe('srgb');
  expect(srgb.components).toEqual([1, 0, 1]);
  expect(srgb.alpha).toBe(0.5);
  expect(srgb.hex).toBe('#ff00ff');
  expect(await parseValueInput('color', 'rebeccapurple')).toBeDefined();
});

test('unparseable, and untransformed types, return undefined', async () => {
  expect(await parseValueInput('color', 'blue-ish')).toBeUndefined();
  expect(await parseValueInput('fontWeight', 'bold')).toBeUndefined();
  expect(await parseValueInput('number', '4')).toBeUndefined();
});

test('dimension and duration split value and unit, spec units only', async () => {
  expect(await parseValueInput('dimension', '4px')).toEqual({
    value: 4,
    unit: 'px',
  });
  expect(await parseValueInput('dimension', '0.25rem')).toEqual({
    value: 0.25,
    unit: 'rem',
  });
  expect(await parseValueInput('dimension', '4vw')).toBeUndefined(); // not a spec unit
  expect(await parseValueInput('duration', '200ms')).toEqual({
    value: 200,
    unit: 'ms',
  });
  expect(await parseValueInput('duration', '0.2s')).toEqual({
    value: 0.2,
    unit: 's',
  });
});

test('render is shape-dispatched, zero-dep, css-correct', () => {
  expect(
    renderCssValue({
      colorSpace: 'oklch',
      components: [0.7017, 0.3225, 328.363],
      alpha: 1,
    }),
  ).toBe('oklch(0.7017 0.3225 328.363)');
  expect(
    renderCssValue({
      colorSpace: 'oklch',
      components: [0.7, 0.3, 328],
      alpha: 0.5,
    }),
  ).toBe('oklch(0.7 0.3 328 / 0.5)');
  expect(
    renderCssValue({
      colorSpace: 'display-p3',
      components: [1, 0, 1],
      alpha: 1,
    }),
  ).toBe('color(display-p3 1 0 1)');
  expect(renderCssValue({ value: 4, unit: 'px' })).toBe('4px');
  expect(renderCssValue({ value: 200, unit: 'ms' })).toBe('200ms');
  expect(renderCssValue('#fff')).toBeUndefined();
  expect(renderCssValue({ anything: 'else' })).toBeUndefined();
});

test('convertColor moves a colour between spaces, deterministically', async () => {
  const stored = {
    colorSpace: 'oklch',
    components: [0.7017, 0.3225, 328.3634],
    alpha: 1,
    hex: '#ff00ff',
  };
  const srgb = (await convertColor(stored, 'srgb')) as {
    colorSpace: string;
    components: number[];
    hex: string;
  };
  expect(srgb.colorSpace).toBe('srgb');
  // gamut-bounded channels clamp to [0,1], absorbing the ±1e-4 drift a rounded-storage round
  // trip would otherwise leave
  expect(srgb.components).toEqual([1, 0, 1]);
  expect(srgb.hex).toBe('#ff00ff');
  // already in target: returned as-is
  expect(await convertColor(stored, 'oklch')).toEqual(stored);
});

test('COLOR_SPACES is the spec enum, spec-sourced', () => {
  expect(COLOR_SPACES).toContain('oklch');
  expect(COLOR_SPACES).toHaveLength(14);
});

test('culori never enters the static graph', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(
    new URL('./values.ts', import.meta.url),
    'utf8',
  );
  expect(source.match(/^import .*culori/m)).toBeNull();
});
