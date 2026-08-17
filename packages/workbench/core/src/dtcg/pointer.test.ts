import { expect, test } from 'vitest';
import {
  evaluatePointer,
  formatPointer,
  isPointerObject,
  parsePointer,
} from './pointer';

test('parsePointer decodes RFC 6901 uri-fragment segments', () => {
  expect(parsePointer('#/colors/blue/$value')).toEqual([
    'colors',
    'blue',
    '$value',
  ]);
  expect(parsePointer('#/a~1b/c~0d')).toEqual(['a/b', 'c~d']); // ~1 = '/', ~0 = '~'
  expect(parsePointer('#/pale%20blue')).toEqual(['pale blue']); // percent-decoding
  expect(parsePointer('#/')).toEqual(['']); // pointer to the '' key — legal, likely a miss
  expect(parsePointer('#/50%')).toBeUndefined(); // malformed percent-sequence is a miss
  expect(parsePointer('not-a-pointer')).toBeUndefined();
  expect(parsePointer('#')).toBeUndefined(); // whole document is not a usable target
  expect(parsePointer('other.json#/x')).toBeUndefined(); // cross-file: schema-forbidden
});

test('evaluatePointer walks objects and arrays; misses are undefined', () => {
  const tree = {
    colors: {
      blue: {
        $value: { colorSpace: 'srgb', components: [0, 0.4, 0.8] },
        $type: 'color',
      },
    },
  };
  expect(evaluatePointer(tree, ['colors', 'blue'])).toBe(tree.colors.blue);
  expect(
    evaluatePointer(tree, ['colors', 'blue', '$value', 'components', '0']),
  ).toBe(0);
  expect(evaluatePointer(tree, ['colors', 'green'])).toBeUndefined();
  expect(
    evaluatePointer(tree, ['colors', 'blue', '$value', 'components', '9']),
  ).toBeUndefined();
  // RFC 6901: array indices are base-10 without leading zeros
  expect(
    evaluatePointer(tree, ['colors', 'blue', '$value', 'components', '00']),
  ).toBeUndefined();
});

test('formatPointer re-escapes segments (round-trips parsePointer)', () => {
  expect(formatPointer(['a/b', 'c~d'])).toBe('#/a~1b/c~0d');
  expect(parsePointer(formatPointer(['colors', 'blue', '$value']))).toEqual([
    'colors',
    'blue',
    '$value',
  ]);
});

test('isPointerObject matches exactly { $ref: string }', () => {
  expect(isPointerObject({ $ref: '#/a' })).toBe(true);
  expect(isPointerObject({ $ref: '#/a', extra: 1 })).toBe(false);
  expect(isPointerObject({ $ref: 42 })).toBe(false);
  expect(isPointerObject('#/a')).toBe(false);
  expect(isPointerObject(null)).toBe(false);
  expect(isPointerObject(['#/a'])).toBe(false);
});
