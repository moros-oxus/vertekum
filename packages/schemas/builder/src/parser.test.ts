import { expect, test } from 'vitest';
import { parse } from './parser';

test('a denotation is a plain alternation of names', () => {
  const module = parse('conspicuity = subtle | normal | bold\n');
  expect(module.productions.get('conspicuity')).toMatchObject({
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
  expect(module.uses).toEqual([
    { spec: './conspicuity.dfn', alias: undefined },
  ]);
  expect(module.productions.has('root')).toBe(false);
  expect(module.root).toMatchObject({
    kind: 'path',
    steps: [
      { term: { kind: 'name', value: 'color' }, optional: false },
      {
        term: {
          kind: 'ref',
          name: 'property',
          imported: false,
          open: false,
          pick: [],
          omit: [],
        },
        optional: false,
      },
      {
        term: {
          kind: 'ref',
          name: 'conspicuity',
          imported: true,
          open: false,
          pick: [],
          omit: [],
        },
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
  expect(module.productions.get('weight')).toMatchObject({
    kind: 'alt',
    options: [
      { kind: 'name', value: '50' },
      {
        kind: 'range',
        min: 100,
        max: 300,
        mode: 'stepped',
        step: 50,
        pad: undefined,
      },
      {
        kind: 'range',
        min: 300,
        max: 900,
        mode: 'stepped',
        step: 100,
        pad: undefined,
      },
      { kind: 'name', value: '950' },
    ],
  });
  const steps = (module.root as { steps: Array<{ term: unknown }> }).steps;
  expect(steps[1].term).toMatchObject({
    kind: 'ref',
    name: 'color-role',
    imported: false,
    open: true,
    pick: [],
    omit: [],
  });
});

test('pragmas: ident-then-string is metadata; nothing is reserved', () => {
  const module = parse(
    [
      'id "vertekum://schema-atlassian/color.json"',
      'title "Atlassian Design System — color"',
      'description "Token path vocabulary."',
      'title = a | b',
      'root = x.<title>',
      '',
    ].join('\n'),
  );
  expect(module.meta).toEqual({
    id: 'vertekum://schema-atlassian/color.json',
    title: 'Atlassian Design System — color',
    description: 'Token path vocabulary.',
  });
  expect(module.productions.has('title')).toBe(true);

  expect(() => parse('author "me"\n')).toThrowError(/unknown pragma 'author'/);
  expect(() => parse('id "a"\nid "b"\n')).toThrowError(/duplicate pragma/);
});

test('an indented line continues the statement above it', () => {
  const module = parse(
    [
      'root = color.[',
      '    text.[subtle | bold]',
      '  | background',
      '  ]',
      'other = a',
      '',
    ].join('\n'),
  );
  expect(module.root).toBeDefined();
  expect(module.productions.has('other')).toBe(true);
});

test('errors carry positions', () => {
  expect(() => parse('root = color.\n')).toThrowError(/1:14/);
  expect(() => parse('a = x\na = y\n')).toThrowError(
    /duplicate production 'a'/,
  );
  expect(() => parse('root = a\nroot = b\n')).toThrowError(/one root/);
  expect(() => parse('w = 300-100/50\n')).toThrowError(/max >= min/);
  expect(() => parse('w = 100-300/50~4\n')).toThrowError(/multiplied scales/);
  expect(() => parse('w = 100-300/2.5\n')).toThrowError(/whole-number step/);
  expect(() => parse('w = 16-64*1\n')).toThrowError(/greater than one/);
  expect(() => parse('use unquoted\n')).toThrowError(/quoted specifier/);
});

test("a bare '*' names the open-set placement instead of a grammar complaint", () => {
  expect(() => parse('root = color.*\n')).toThrow(
    "1:14 '*' marks a set open and sits inside the reference or group it opens — <name*> or [a | b *]",
  );
});

test("a '*' trailing a closed reference gets the same hint", () => {
  expect(() => parse('root = color.<scale>*\n')).toThrow(
    "1:21 '*' marks a set open and sits inside the reference or group it opens",
  );
});

test('digit-leading names are single names, not number + identifier', () => {
  const module = parse('xsmall = 2xs | 3xs | 4xs\n');
  expect(module.productions.get('xsmall')).toMatchObject({
    kind: 'alt',
    options: [
      { kind: 'name', value: '2xs' },
      { kind: 'name', value: '3xs' },
      { kind: 'name', value: '4xs' },
    ],
  });
});

test('digit-leading names work as pick/omit members and may carry hyphens', () => {
  const module = parse(
    'size = 2xs | 4k-display | small\nroot = t.<size [2xs, 4k-display]>\n',
  );
  expect(module.root).toMatchObject({
    kind: 'path',
    steps: [
      { term: { kind: 'name', value: 't' } },
      { term: { kind: 'ref', name: 'size', pick: ['2xs', '4k-display'] } },
    ],
  });
});

test('a digit-leading name beside a range keeps both meanings', () => {
  const module = parse('scale = 2xs | 100-300/100\n');
  expect(module.productions.get('scale')).toMatchObject({
    kind: 'alt',
    options: [
      { kind: 'name', value: '2xs' },
      { kind: 'range', min: 100, max: 300, step: 100 },
    ],
  });
});

test('affixed scales: suffix, prefix, infix, and pad', () => {
  const module = parse(
    't-shirt = (2-4)xs | xs(2-4) | x(2-8/2)s | (02-08/2)xxl\n',
  );
  expect(module.productions.get('t-shirt')).toMatchObject({
    kind: 'alt',
    options: [
      { kind: 'range', min: 2, max: 4, step: 1, suffix: 'xs' },
      { kind: 'range', min: 2, max: 4, step: 1, prefix: 'xs' },
      { kind: 'range', min: 2, max: 8, step: 2, prefix: 'x', suffix: 's' },
      { kind: 'range', min: 2, max: 8, step: 2, pad: 2, suffix: 'xxl' },
    ],
  });
});

test('a bare range without a step is stepped by 1; parens alone are grouping', () => {
  const module = parse('scale = 2-4 | (16-64*1.25~4)\n');
  expect(module.productions.get('scale')).toMatchObject({
    kind: 'alt',
    options: [
      { kind: 'range', min: 2, max: 4, mode: 'stepped', step: 1 },
      { kind: 'range', min: 16, max: 64, mode: 'multiplied', quantum: 4 },
    ],
  });
});

test('a digit-leading affix is refused — the parenthesis boundary must stay readable', () => {
  expect(() => parse('scale = (2-4)5x\n')).toThrow();
  expect(() => parse('scale = (2-4~3)\n')).toThrow(/multiplied scales/);
});
