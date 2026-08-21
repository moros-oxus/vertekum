import { expect, test } from 'vitest';
import { evaluateScale } from './scale';

test('stepped scales enumerate inclusively', () => {
  expect(
    evaluateScale({ kind: 'stepped', min: 100, max: 300, step: 50 }).names,
  ).toEqual(['100', '150', '200', '250', '300']);
});

test('padding formats every name to the declared width', () => {
  const { names } = evaluateScale({
    kind: 'stepped',
    min: 25,
    max: 150,
    step: 25,
    pad: 3,
  });
  expect(names).toEqual(['025', '050', '075', '100', '125', '150']);
});

test('the type scale: ×1.25 quantized to the nearest multiple of 4', () => {
  const { names, values, collisions } = evaluateScale({
    kind: 'multiplied',
    min: 16,
    max: 64,
    factor: 1.25,
    quantum: 4,
  });
  expect(values).toEqual([16, 20, 24, 32, 40, 48, 60]);
  expect(names).toEqual(['16', '20', '24', '32', '40', '48', '60']);
  expect(collisions).toEqual([]);
});

test('integer factors double cleanly', () => {
  expect(
    evaluateScale({ kind: 'multiplied', min: 25, max: 400, factor: 2 }).values,
  ).toEqual([25, 50, 100, 200, 400]);
});

test('the raw series is the bound; a quantized value may stand past max', () => {
  const { values } = evaluateScale({
    kind: 'multiplied',
    min: 16,
    max: 63,
    factor: 1.97,
    quantum: 8,
  });
  // raw 16, 31.52, 62.09 (≤ 63) → 16, 32, 64 — the last stands although 64 > max
  expect(values).toEqual([16, 32, 64]);
});

test('collisions dedupe forward and are reported', () => {
  const { values, collisions } = evaluateScale({
    kind: 'multiplied',
    min: 10,
    max: 16,
    factor: 1.1,
    quantum: 4,
  });
  // raw 10, 11, 12.1, 13.31, 14.64, 16.1(out) → 12, 12, 12, 12, 16
  expect(values).toEqual([12, 16]);
  expect(collisions).toEqual([11, 12.100000000000001, 13.310000000000002]);
});

test('a non-integral unquantized step is an error, and guards hold', () => {
  expect(() =>
    evaluateScale({ kind: 'multiplied', min: 16, max: 64, factor: 1.25 }),
  ).toThrowError(/not a whole number/);
  expect(() =>
    evaluateScale({ kind: 'stepped', min: 0, max: 10, step: 0 }),
  ).toThrowError(/greater than zero/);
  expect(() =>
    evaluateScale({ kind: 'multiplied', min: 1, max: 10, factor: 1 }),
  ).toThrowError(/greater than one/);
  expect(() =>
    evaluateScale({ kind: 'stepped', min: 10, max: 1, step: 1 }),
  ).toThrowError(/max >= min/);
});
