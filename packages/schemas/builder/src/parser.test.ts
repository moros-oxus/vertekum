import { expect, test } from 'vitest';
import { parse } from './parser';

test('a denotation is a plain alternation of names', () => {
  const module = parse('conspicuity = subtle | normal | bold\n');
  expect(module.productions.get('conspicuity')).toEqual({
    kind: 'alt',
    options: [
      { kind: 'name', value: 'subtle' },
      { kind: 'name', value: 'normal' },
      { kind: 'name', value: 'bold' },
    ],
  });
});

test('the contrived color module parses: use, fragments, root with refs and ?', () => {
  const module = parse(
    [
      '# Atlassian-flavoured example',
      'use "./conspicuity.dfn"',
      '',
      'property = background | text',
      'root = color.<property>.<@conspicuity>?',
      '',
    ].join('\n'),
  );
  expect(module.uses).toEqual(['./conspicuity.dfn']);
  expect(module.productions.has('root')).toBe(false);
  expect(module.root).toEqual({
    kind: 'path',
    steps: [
      { term: { kind: 'name', value: 'color' }, optional: false },
      {
        term: { kind: 'ref', name: 'property', imported: false, open: false },
        optional: false,
      },
      {
        term: { kind: 'ref', name: 'conspicuity', imported: true, open: false },
        optional: true,
      },
    ],
  });
});

test('groups hold sub-paths (branches, not guards) and take an open marker', () => {
  const module = parse('root = color.text.[neutral.<emphasis>? | brand *]\n');
  const steps = (module.root as { steps: unknown[] }).steps as Array<{
    term: { kind: string; node?: unknown; open?: boolean };
  }>;
  expect(steps[2].term.kind).toBe('group');
  expect(steps[2].term.open).toBe(true);
});

test('open refs, ranges, and kebab identifiers lex without collision', () => {
  const module = parse(
    'weight = 50 | 100-300/50 | 300-900/100 | 950\nroot = font.<color-role*>.<weight>\n',
  );
  expect(module.productions.get('weight')).toEqual({
    kind: 'alt',
    options: [
      { kind: 'name', value: '50' },
      { kind: 'range', min: 100, max: 300, step: 50 },
      { kind: 'range', min: 300, max: 900, step: 100 },
      { kind: 'name', value: '950' },
    ],
  });
  const steps = (module.root as { steps: Array<{ term: unknown }> }).steps;
  expect(steps[1].term).toEqual({
    kind: 'ref',
    name: 'color-role',
    imported: false,
    open: true,
  });
});

test('errors carry positions', () => {
  expect(() => parse('root = color.\n')).toThrowError(/1:14/);
  expect(() => parse('a = x\na = y\n')).toThrowError(
    /duplicate production 'a'/,
  );
  expect(() => parse('root = a\nroot = b\n')).toThrowError(/one root/);
  expect(() => parse('w = 300-100/50\n')).toThrowError(/max >= min/);
  expect(() => parse('use unquoted\n')).toThrowError(/quoted specifier/);
});
