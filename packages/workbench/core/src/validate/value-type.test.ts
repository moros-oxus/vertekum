import { expect, test } from 'vitest';
import { valueMatchesType } from './value-type';

test('values are judged by the published per-type schemas', async () => {
  expect(await valueMatchesType('number', 0.4)).toBe(true);
  expect(await valueMatchesType('color', 0.4)).toBe(false);
  expect(
    await valueMatchesType('color', {
      colorSpace: 'srgb',
      components: [0, 0.4, 0.8],
      alpha: 1,
      hex: '#0066cc',
    }),
  ).toBe(true);
  expect(await valueMatchesType('dimension', { value: 4, unit: 'px' })).toBe(
    true,
  );
  expect(await valueMatchesType('dimension', 'px')).toBe(false);
});

test('an unknown type has no schema and nothing to say', async () => {
  expect(await valueMatchesType('somethingCustom', 42)).toBeUndefined();
});

test('composite types resolve their internal refs', async () => {
  expect(
    await valueMatchesType('border', {
      width: { value: 1, unit: 'px' },
      style: 'solid',
      color: {
        colorSpace: 'srgb',
        components: [0, 0.4, 0.8],
        alpha: 1,
        hex: '#0066cc',
      },
    }),
  ).toBe(true);
  expect(await valueMatchesType('border', { style: 'solid' })).toBe(false);
});
