import { expect, test } from 'vitest';
import { readBatch, splitWords } from './batch-input';

test('splitWords quotes like a POSIX shell', () => {
  expect(
    splitWords(`token add color.accent '{color.brand.500}' --type color`),
  ).toEqual([
    'token',
    'add',
    'color.accent',
    '{color.brand.500}',
    '--type',
    'color',
  ]);
  expect(splitWords(`a "b \\"c\\" \\\\d" 'e "f"' g\\ h`)).toEqual([
    'a',
    'b "c" \\d',
    'e "f"',
    'g h',
  ]);
  expect(splitWords(`a '' b`)).toEqual(['a', '', 'b']);
  expect(splitWords(`token set x 1 # a trailing comment`)).toEqual([
    'token',
    'set',
    'x',
    '1',
  ]);
  expect(splitWords(`a#b`)).toEqual(['a#b']); // `#` starts a comment only at a word's start
  expect(() => splitWords(`a 'open`)).toThrow('unterminated quote');
});

test('readBatch: one command per line; blank lines, comments and a leading vertekum/vtk dropped', () => {
  const steps = readBatch(
    [
      '# overrides first',
      '',
      `vertekum token add color.accent '{color.brand.500}' --type color --set globex/palette`,
      `vtk token add color.accent '{color.berry.500}' --type color --set core`,
      `token rename color.old color.new`,
    ].join('\n'),
  );
  expect(steps).toEqual([
    {
      line: 3,
      argv: [
        'token',
        'add',
        'color.accent',
        '{color.brand.500}',
        '--type',
        'color',
        '--set',
        'globex/palette',
      ],
    },
    {
      line: 4,
      argv: [
        'token',
        'add',
        'color.accent',
        '{color.berry.500}',
        '--type',
        'color',
        '--set',
        'core',
      ],
    },
    { line: 5, argv: ['token', 'rename', 'color.old', 'color.new'] },
  ]);
});

test('readBatch: a JSON array of argument arrays, numbered from 1', () => {
  expect(
    readBatch(
      ' [["token", "remove", "x"], ["vertekum", "set", "add", "brand"]]',
    ),
  ).toEqual([
    { line: 1, argv: ['token', 'remove', 'x'] },
    { line: 2, argv: ['set', 'add', 'brand'] },
  ]);
  expect(() => readBatch('[["token", 1]]')).toThrow(
    'batch entry 1 must be an array of strings',
  );
  expect(() => readBatch('[oops')).toThrow('batch is not valid JSON');
  expect(() => readBatch(`token add 'x`)).toThrow('line 1: unterminated quote');
});
