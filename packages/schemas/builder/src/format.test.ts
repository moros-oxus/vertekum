import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { fixSource, formatSource, resolveIndent } from './format';

/** Format, and assert the result is a fixed point — every test input proves idempotency. */
function fmt(source: string, indent = '  '): string {
  const once = formatSource(source, { indent });
  expect(formatSource(once, { indent })).toBe(once);
  return once;
}

test('canonical spacing within a line', () => {
  expect(fmt('emphasis=subtle|bold\n')).toBe('emphasis = subtle | bold\n');
  expect(fmt('root = color . [ text|icon ] . <emphasis> ?\n')).toBe(
    'root = color.[text | icon].<emphasis>?\n',
  );
  expect(fmt('x = <scale ![ 0,500 ]>\n')).toBe('x = <scale ![0, 500]>\n');
  expect(fmt('x = <scale[a , b]>\n')).toBe('x = <scale [a, b]>\n');
  expect(fmt('open = [ small|large   * ]\n')).toBe(
    'open = [small | large *]\n',
  );
  expect(fmt('o = <roles *>\n')).toBe('o = <roles*>\n');
  expect(fmt('use "./colors.dfn"   as   c\n')).toBe(
    'use "./colors.dfn" as c\n',
  );
  expect(fmt('t = (2-4)xs | x(2-8/2)l\n')).toBe('t = (2-4)xs | x(2-8/2)l\n');
});

test('the review case: a scruffy block normalizes to block style', () => {
  const scruffy = ['color = [', ' one', ' | two', ' | three', ']', ''].join(
    '\n',
  );
  expect(fmt(scruffy)).toBe(
    ['color = [', '  one', '  | two', '  | three', ']', ''].join('\n'),
  );
});

test('blocks nest; inline groups ride inside without adding levels', () => {
  const source = [
    'root = color.[',
    '<property>.<role>?',
    '      | border.[bold | code]',
    '  | interaction.[',
    'hovered',
    '        | pressed',
    ']',
    ']',
    '',
  ].join('\n');
  expect(fmt(source)).toBe(
    [
      'root = color.[',
      '  <property>.<role>?',
      '  | border.[bold | code]',
      '  | interaction.[',
      '    hovered',
      '    | pressed',
      '  ]',
      ']',
      '',
    ].join('\n'),
  );
});

test('comments keep their level; trailing comments sit two spaces off', () => {
  const source = [
    '# top note',
    'scale = [',
    '# inner note',
    '100',
    '| 200   # loud',
    ']',
    '',
  ].join('\n');
  expect(fmt(source)).toBe(
    [
      '# top note',
      'scale = [',
      '  # inner note',
      '  100',
      '  | 200  # loud',
      ']',
      '',
    ].join('\n'),
  );
});

test('whitespace hygiene: blank runs collapse, trailing newline exactly one', () => {
  expect(fmt('a = x\n\n\n\nb = y')).toBe('a = x\n\nb = y\n');
});

test('a configured indent unit applies per block level', () => {
  const source = 'color = [\none\n| two\n]\n';
  expect(fmt(source, '\t')).toBe('color = [\n\tone\n\t| two\n]\n');
  expect(fmt(source, '    ')).toBe('color = [\n    one\n    | two\n]\n');
});

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

test('resolveIndent: config wins, then .editorconfig, then two spaces', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vtk-fmt-'));
  dirs.push(dir);
  mkdirSync(join(dir, 'schemas'));
  const file = join(dir, 'schemas/color.dfn');
  writeFileSync(file, 'root = a\n');

  expect(resolveIndent(file)).toBe('  ');
  expect(resolveIndent(file, 4)).toBe('    ');
  expect(resolveIndent(file, '\t')).toBe('\t');

  writeFileSync(
    join(dir, '.editorconfig'),
    ['root = true', '[*]', 'indent_style = space', 'indent_size = 4', ''].join(
      '\n',
    ),
  );
  expect(resolveIndent(file)).toBe('    ');

  // A closer, more specific section wins.
  writeFileSync(
    join(dir, 'schemas/.editorconfig'),
    ['[*.dfn]', 'indent_style = tab', ''].join('\n'),
  );
  expect(resolveIndent(file)).toBe('\t');
});

test('fixSource relocates a trailing open-set mark on refs and groups', () => {
  const { content, fixes } = fixSource('a = <roles>*\nb = [x | y]*\nc = ok\n');
  expect(content).toBe('a = <roles*>\nb = [x | y *]\nc = ok\n');
  expect(fixes).toHaveLength(2);
  expect(fixes[0].message).toContain('reference');
  expect(fixes[1].message).toContain('group');
});

test('fixSource leaves the unfixable bare star and unlexable sources alone', () => {
  expect(fixSource('a = color.*\n').fixes).toEqual([]);
  const broken = 'a = "unterminated\n';
  expect(fixSource(broken)).toEqual({ content: broken, fixes: [] });
});
