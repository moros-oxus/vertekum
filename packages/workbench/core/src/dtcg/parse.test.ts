import { describe, expect, test } from 'vitest';
import { parseCollection } from './parse';

describe('parseCollection', () => {
  test('lifts a string $description onto the token', () => {
    const tokens = parseCollection({
      'core.json': {
        color: {
          primary: {
            $type: 'color',
            $value: '#f00',
            $description: 'brand accent',
          },
        },
      },
    });

    expect(tokens[0]?.description).toBe('brand accent');
  });

  test('omits description when $description is absent or non-string', () => {
    const tokens = parseCollection({
      'core.json': {
        color: {
          primary: { $type: 'color', $value: '#f00', $description: 42 },
        },
      },
    });

    expect(tokens[0]).not.toHaveProperty('description');
  });

  test('flattens nested groups into tokens with dotted paths', () => {
    const tokens = parseCollection({
      'core.json': {
        color: {
          brand: {
            primary: { $type: 'color', $value: '#f00' },
          },
        },
      },
    });

    expect(tokens).toEqual([
      {
        id: 'core:color.brand.primary',
        path: ['color', 'brand', 'primary'],
        type: 'color',
        value: '#f00',
        set: 'core',
      },
    ]);
  });

  test('an org.vertekum.ident already on disk is inert, not an identity', () => {
    const tokens = parseCollection({
      'core.json': {
        color: {
          primary: {
            $type: 'color',
            $value: '#f00',
            $extensions: { 'org.vertekum.ident': 'fixed-1' },
          },
        },
      },
    });

    // Identity is (set, path). A legacy ident falls through as an unrecognized vtk sub-key.
    expect(tokens[0]?.id).toBe('core:color.primary');
    expect(tokens[0]?.vtk).toBeUndefined();
  });

  test('identity distinguishes the same path in different sets', () => {
    const tokens = parseCollection({
      'light.json': { surface: { $type: 'color', page: { $value: '#fff' } } },
      'dark.json': { surface: { $type: 'color', page: { $value: '#000' } } },
    });

    expect(tokens.map((t) => t.id)).toEqual([
      'light:surface.page',
      'dark:surface.page',
    ]);
  });

  test('lifts active org.vertekum.* sub-keys (meta), ignoring inactive ones (themes)', () => {
    const tokens = parseCollection({
      'core.json': {
        color: {
          primary: {
            $type: 'color',
            $value: '#f00',
            $extensions: {
              'org.vertekum.meta': { note: 'hi' },
              'org.vertekum.themes': { dark: { $value: '#F00' } },
            },
          },
        },
      },
    });

    expect(tokens[0]?.vtk).toEqual({
      meta: { note: 'hi' },
    });
  });

  test('collects tokens across multiple files', () => {
    const tokens = parseCollection({
      'a.json': { color: { a: { $type: 'color', $value: '#f00' } } },
      'b.json': { color: { b: { $type: 'color', $value: '#0f0' } } },
    });

    expect(tokens.map((t) => t.path.join('.')).sort()).toEqual([
      'color.a',
      'color.b',
    ]);
  });

  test('stamps each token with its set (filename minus .json)', () => {
    const tokens = parseCollection({
      'core.json': { color: { a: { $type: 'color', $value: '#f00' } } },
      'brand.json': { color: { b: { $type: 'color', $value: '#0f0' } } },
    });
    const setOf = (p: string) =>
      tokens.find((t) => t.path.join('.') === p)?.set;
    expect(setOf('color.a')).toBe('core');
    expect(setOf('color.b')).toBe('brand');
  });
});

test('a group $type is inherited by descendants that do not declare their own', () => {
  const tokens = parseCollection({
    'core.json': {
      color: {
        $type: 'color',
        brand: { 500: { $value: '#c8102e' } },
        // A nested group inherits through, and a token's own $type still wins.
        alias: { $type: 'dimension', gap: { $value: '4px' } },
      },
      space: { $type: 'dimension', 1: { $value: '4px' } },
    },
  });

  const byPath = Object.fromEntries(
    tokens.map((t) => [t.path.join('.'), t.type]),
  );
  expect(byPath['color.brand.500']).toBe('color');
  expect(byPath['color.alias.gap']).toBe('dimension');
  expect(byPath['space.1']).toBe('dimension');
});

test('a token with no $type anywhere gets an empty type, never the string "undefined"', () => {
  const [token] = parseCollection({
    'core.json': { loose: { thing: { $value: '1' } } },
  });
  expect(token?.type).toBe('');
});

test('a non-string $type does not become a type', () => {
  const [token] = parseCollection({
    'core.json': { loose: { thing: { $type: 5, $value: '1' } } },
  });
  // Coercing would make this the string '5' — a malformed type masquerading as a valid one.
  expect(token?.type).toBe('');
});

test('a group root token parses at <group>.$root, inheriting the group type', () => {
  const tokens = parseCollection({
    'core.json': {
      color: {
        text: {
          $type: 'color',
          $root: { $value: '#172B4D' },
          subtle: { $value: '#44546F' },
        },
      },
    },
  });

  expect(tokens.map((t) => t.path.join('.')).sort()).toEqual([
    'color.text.$root',
    'color.text.subtle',
  ]);
  const root = tokens.find((t) => t.path.at(-1) === '$root');
  expect(root?.type).toBe('color');
  expect(root?.value).toBe('#172B4D');
});

test('a root token declaring its own type wins over the group', () => {
  const tokens = parseCollection({
    'core.json': {
      border: {
        width: { $type: 'dimension', $root: { $type: 'number', $value: 1 } },
      },
    },
  });
  expect(tokens[0]?.type).toBe('number');
});

test('a root token nested under a root-bearing group still parses', () => {
  const tokens = parseCollection({
    'core.json': {
      color: {
        text: {
          $type: 'color',
          $root: { $value: '#000' },
          accent: {
            blue: {
              $root: { $value: '#0052CC' },
              bolder: { $value: '#0747A6' },
            },
          },
        },
      },
    },
  });
  expect(tokens.map((t) => t.path.join('.')).sort()).toEqual([
    'color.text.$root',
    'color.text.accent.blue.$root',
    'color.text.accent.blue.bolder',
  ]);
});

test('a token-position $ref token is parsed, and materialized against its own set', () => {
  const tokens = parseCollection({
    'core.json': {
      base: {
        $type: 'color',
        $value: { colorSpace: 'srgb', components: [0, 0.4, 0.8] },
      },
      alias: { $ref: '#/base' }, // → token node: adopt its value
      lift: { $ref: '#/base/$value' }, // → the $value location
      hue: { $ref: '#/base/$value/components/0', $type: 'number' }, // → a fragment
    },
  });
  const byPath = new Map(tokens.map((t) => [t.path.join('.'), t]));
  expect(byPath.get('alias')?.ref).toBe('#/base');
  expect(byPath.get('alias')?.value).toEqual({
    colorSpace: 'srgb',
    components: [0, 0.4, 0.8],
  });
  expect(byPath.get('lift')?.value).toEqual({
    colorSpace: 'srgb',
    components: [0, 0.4, 0.8],
  });
  expect(byPath.get('hue')?.value).toBe(0);
  expect(byPath.get('hue')?.type).toBe('number'); // own $type wins; target's type is NOT adopted
});

test('$ref chains follow; cycles and misses stay undefined with a refIssue', () => {
  const tokens = parseCollection({
    'core.json': {
      a: { $value: 4 },
      b: { $ref: '#/a' },
      c: { $ref: '#/b' }, // chain through another $ref token
      dangling: { $ref: '#/nope' },
      group: { child: { $value: 1 } },
      toGroup: { $ref: '#/group' }, // a group is not a value
      x: { $ref: '#/y' },
      y: { $ref: '#/x' }, // cycle
    },
  });
  const byPath = new Map(tokens.map((t) => [t.path.join('.'), t]));
  expect(byPath.get('c')?.value).toBe(4);
  expect(byPath.get('dangling')?.value).toBeUndefined();
  expect(byPath.get('dangling')?.refIssue).toBe('dangling');
  expect(byPath.get('toGroup')?.refIssue).toBe('dangling');
  expect(byPath.get('x')?.refIssue).toBe('cycle');
  expect(byPath.get('y')?.refIssue).toBe('cycle');
});

test('pointers address the composed document: the flat parse merges all sets', () => {
  // The resolver spec resolves references AFTER flattening — a pointer in b.json can therefore
  // reach a token contributed by a.json. Under a resolver selection the scope is that bundle
  // (resolveExporterInput re-materializes); at parse it is the whole collection merged.
  const tokens = parseCollection({
    'a.json': { base: { $value: 1 } },
    'b.json': { cross: { $ref: '#/base' } },
  });
  const cross = tokens.find((t) => t.path.join('.') === 'cross');
  expect(cross?.refIssue).toBeUndefined();
  expect(cross?.value).toBe(1);
});

test('a later set wins the merged position a pointer addresses', () => {
  const tokens = parseCollection({
    'a.json': { base: { $value: 1 }, uses: { $ref: '#/base' } },
    'b.json': { base: { $value: 2 } },
  });
  const uses = tokens.find((t) => t.path.join('.') === 'uses');
  expect(uses?.value).toBe(2); // last-wins by path, same as alias resolution's index
});

test('$root is an ordinary pointer segment', () => {
  const tokens = parseCollection({
    'core.json': {
      color: {
        text: {
          $root: { $type: 'color', $value: '#111' },
          subtle: { $ref: '#/color/text/$root' },
        },
      },
    },
  });
  const subtle = tokens.find((t) => t.path.join('.') === 'color.text.subtle');
  expect(subtle?.value).toBe('#111');
});

test('value-position {$ref} objects materialize in place, deep in composites', () => {
  const tokens = parseCollection({
    'core.json': {
      blue: {
        $type: 'color',
        $value: { colorSpace: 'srgb', components: [0, 0.4, 0.8] },
      },
      wholesale: { $type: 'color', $value: { $ref: '#/blue/$value' } },
      border: {
        $type: 'border',
        $value: {
          width: { value: 1, unit: 'px' },
          style: 'solid',
          color: { $ref: '#/blue/$value' },
        },
      },
    },
  });
  const byPath = new Map(tokens.map((t) => [t.path.join('.'), t]));
  expect(byPath.get('wholesale')?.value).toEqual({
    colorSpace: 'srgb',
    components: [0, 0.4, 0.8],
  });
  expect(byPath.get('wholesale')?.sourceValue).toEqual({
    $ref: '#/blue/$value',
  });
  expect((byPath.get('border')?.value as { color: unknown }).color).toEqual({
    colorSpace: 'srgb',
    components: [0, 0.4, 0.8],
  });
  expect(byPath.get('border')?.sourceValue).toEqual({
    width: { value: 1, unit: 'px' },
    style: 'solid',
    color: { $ref: '#/blue/$value' },
  });
});

test('a missing value-position target leaves the {$ref} marker for the validator', () => {
  const tokens = parseCollection({
    'core.json': { broken: { $value: { $ref: '#/nope' } } },
  });
  expect(tokens[0]?.value).toEqual({ $ref: '#/nope' });
  expect(tokens[0]?.sourceValue).toEqual({ $ref: '#/nope' });
});

test('values without pointers carry no sourceValue', () => {
  const tokens = parseCollection({ 'core.json': { plain: { $value: 4 } } });
  expect(tokens[0]?.sourceValue).toBeUndefined();
});
