import { expect, test } from 'vitest';
import type { ResolverDocument } from '../document/resolver-types';
import type { Token } from '../document/types';
import { parseCollection } from '../dtcg/parse';
import { aliasValidator } from './builtin-validators';

const t = (path: string[], value: unknown, set: string): Token => ({
  id: `${set}:${path.join('.')}`,
  path,
  type: 'color',
  value,
  set,
});
const resolver: ResolverDocument = {
  version: '2025.10',
  sets: { core: { sources: [{ $ref: 'core.json' }] } },
  modifiers: {
    theme: {
      contexts: {
        light: [{ $ref: 'light.json' }],
        dark: [{ $ref: 'dark.json' }],
      },
      default: 'light',
    },
  },
  resolutionOrder: [{ $ref: '#/sets/core' }, { $ref: '#/modifiers/theme' }],
};

test('a reference with no target is reported as dangling', async () => {
  const tokens = [t(['a'], '{missing.token}', 'core')];
  const diagnostics = await aliasValidator.validate({
    tokens,
    sets: ['core'],
    resolvers: new Map([['default', resolver]]),
  });
  expect(diagnostics[0]?.code).toBe('token/dangling-alias');
  expect(diagnostics[0]?.severity).toBe('error');
});

test('a reference resolving only in one context is reported for the other', async () => {
  const tokens = [
    t(['a'], '{only.in.light}', 'core'),
    t(['only', 'in', 'light'], '#fff', 'light'),
  ];
  const diagnostics = await aliasValidator.validate({
    tokens,
    sets: ['core', 'light', 'dark'],
    resolvers: new Map([['default', resolver]]),
  });
  expect(diagnostics.some((d) => d.message.includes('theme=dark'))).toBe(true);
});

test('a fully resolvable alias produces no diagnostics', async () => {
  const tokens = [t(['a'], '{b}', 'core'), t(['b'], '#fff', 'core')];
  const diagnostics = await aliasValidator.validate({
    tokens,
    sets: ['core'],
    resolvers: new Map([['default', resolver]]),
  });
  expect(diagnostics).toEqual([]);
});

test('a dangling token-position pointer is an error', async () => {
  const tokens = parseCollection({
    'core.json': { broken: { $ref: '#/nope' } },
  });
  const out = await aliasValidator.validate({
    tokens,
    sets: ['core'],
    resolvers: new Map(),
  });
  expect(out).toEqual([
    expect.objectContaining({
      code: 'token/dangling-pointer',
      severity: 'error',
    }),
  ]);
});

test('a pointer cycle is an error', async () => {
  const tokens = parseCollection({
    'core.json': { x: { $ref: '#/y' }, y: { $ref: '#/x' } },
  });
  const out = await aliasValidator.validate({
    tokens,
    sets: ['core'],
    resolvers: new Map(),
  });
  expect(out.filter((d) => d.code === 'token/cyclic-pointer')).toHaveLength(2);
});

test('a surviving value-position marker is a dangling pointer', async () => {
  const tokens = parseCollection({
    'core.json': { broken: { $value: { $ref: '#/nope' } } },
  });
  const out = await aliasValidator.validate({
    tokens,
    sets: ['core'],
    resolvers: new Map(),
  });
  expect(out).toEqual([
    expect.objectContaining({ code: 'token/dangling-pointer' }),
  ]);
});

test('resolvable pointers produce no diagnostics', async () => {
  const tokens = parseCollection({
    'core.json': { base: { $value: 4 }, ok: { $ref: '#/base' } },
  });
  const out = await aliasValidator.validate({
    tokens,
    sets: ['core'],
    resolvers: new Map(),
  });
  expect(out).toEqual([]);
});

test('a pointer resolving only in one context is reported for the other', async () => {
  // `#/only/in/light` addresses the FLATTENED document, so it resolves when the light context
  // contributes the target and dangles when dark replaces that set — exactly like an alias.
  const tokens = parseCollection({
    'core.json': { a: { $ref: '#/only/in/light' } },
    'light.json': { only: { in: { light: { $value: '#fff' } } } },
    'dark.json': { unrelated: { $value: '#000' } },
  });
  const diagnostics = await aliasValidator.validate({
    tokens,
    sets: ['core', 'light', 'dark'],
    resolvers: new Map([['default', resolver]]),
  });
  expect(diagnostics).toHaveLength(1);
  expect(diagnostics[0]?.code).toBe('token/dangling-pointer');
  expect(diagnostics[0]?.message).toContain('theme=dark');
});

test('an alias declaring a type that conflicts with the target is a type mismatch', async () => {
  const tokens = parseCollection({
    'core.json': {
      space: { $type: 'dimension', $value: { value: 4, unit: 'px' } },
      accent: { $type: 'color', $value: '{space}' },
    },
  });
  const out = await aliasValidator.validate({
    tokens,
    sets: ['core'],
    resolvers: new Map(),
  });
  expect(out).toEqual([
    expect.objectContaining({ code: 'token/type-mismatch', severity: 'error' }),
  ]);
});

test('matching types, and untyped referencing tokens, pass (inheritance rule)', async () => {
  const tokens = parseCollection({
    'core.json': {
      base: {
        $type: 'color',
        $value: {
          colorSpace: 'srgb',
          components: [0, 0, 0],
          alpha: 1,
          hex: '#000000',
        },
      },
      same: { $type: 'color', $value: '{base}' },
      inherits: { $value: '{base}' }, // no own or group type → §5.2.2 inheritance
    },
  });
  const out = await aliasValidator.validate({
    tokens,
    sets: ['core'],
    resolvers: new Map(),
  });
  expect(out).toEqual([]);
});

test('the target chain resolves to the first non-empty type', async () => {
  const tokens = parseCollection({
    'core.json': {
      base: { $type: 'dimension', $value: { value: 4, unit: 'px' } },
      middle: { $value: '{base}' }, // untyped link in the chain
      end: { $type: 'color', $value: '{middle}' },
    },
  });
  const out = await aliasValidator.validate({
    tokens,
    sets: ['core'],
    resolvers: new Map(),
  });
  expect(out.map((d) => d.code)).toEqual(['token/type-mismatch']);
});

test('a name-space $ref is compared exactly like a curly alias', async () => {
  const tokens = parseCollection({
    'core.json': {
      space: { $type: 'dimension', $value: { value: 4, unit: 'px' } },
      bad: { $ref: '#/space', $type: 'color' },
      good: { $ref: '#/space', $type: 'dimension' },
      free: { $ref: '#/space' }, // untyped → inherits
    },
  });
  const out = await aliasValidator.validate({
    tokens,
    sets: ['core'],
    resolvers: new Map(),
  });
  expect(out.map((d) => d.code)).toEqual(['token/type-mismatch']);
  expect(out[0]?.message).toContain("'bad'");
});

test('type mismatches are per-composition, like dangling references', async () => {
  const tokens = parseCollection({
    'core.json': { a: { $type: 'color', $value: '{x}' } },
    'light.json': {
      x: {
        $type: 'color',
        $value: {
          colorSpace: 'srgb',
          components: [1, 1, 1],
          alpha: 1,
          hex: '#ffffff',
        },
      },
    },
    'dark.json': {
      x: { $type: 'dimension', $value: { value: 1, unit: 'px' } },
    },
  });
  const out = await aliasValidator.validate({
    tokens,
    sets: ['core', 'light', 'dark'],
    resolvers: new Map([['default', resolver]]),
  });
  expect(out).toHaveLength(1);
  expect(out[0]?.code).toBe('token/type-mismatch');
  expect(out[0]?.message).toContain('theme=dark');
});

test('a fragment materializing the wrong shape for the declared type is a mismatch', async () => {
  const tokens = parseCollection({
    'core.json': {
      blue: {
        $type: 'color',
        $value: {
          colorSpace: 'srgb',
          components: [0, 0.4, 0.8],
          alpha: 1,
          hex: '#0066cc',
        },
      },
      okNum: { $ref: '#/blue/$value/components/1', $type: 'number' },
      badColor: { $ref: '#/blue/$value/components/1', $type: 'color' },
      okLift: { $ref: '#/blue/$value', $type: 'color' },
      okWrapped: { $type: 'color', $value: { $ref: '#/blue/$value' } },
      badWrapped: { $type: 'dimension', $value: { $ref: '#/blue/$value' } },
    },
  });
  const out = await aliasValidator.validate({
    tokens,
    sets: ['core'],
    resolvers: new Map(),
  });
  expect(out.map((d) => d.code)).toEqual([
    'token/type-mismatch',
    'token/type-mismatch',
  ]);
  const messages = out.map((d) => d.message).join('\n');
  expect(messages).toContain("'badColor'");
  expect(messages).toContain("'badWrapped'");
});

test('literal wrong values are the format binding’s business, not this validator’s', async () => {
  const tokens = parseCollection({
    'core.json': { odd: { $type: 'color', $value: 42 } },
  });
  const out = await aliasValidator.validate({
    tokens,
    sets: ['core'],
    resolvers: new Map(),
  });
  expect(out).toEqual([]);
});
