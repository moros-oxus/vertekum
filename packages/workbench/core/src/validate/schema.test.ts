import { expect, test } from 'vitest';
import { DTCG_TOKEN_SCHEMA } from './dtcg-schema';
import { validateFiles } from './schema';
import type { Diagnostic } from './validator';

/** Index access is `| undefined` under noUncheckedIndexedAccess; assert presence once, here. */
function first(diagnostics: Diagnostic[]): Diagnostic {
  const [diagnostic] = diagnostics;
  if (!diagnostic) throw new Error('expected at least one diagnostic');
  return diagnostic;
}

test('a valid collection produces no diagnostics', async () => {
  expect(
    await validateFiles({
      'core.json': {
        color: {
          $type: 'color',
          base: { $value: '#000000', $description: 'ink' },
        },
        space: { $type: 'dimension', 1: { $value: '4px' } },
      },
    }),
  ).toEqual([]);
});

test('a mistyped $ key is an error, not a silently ignored property', async () => {
  const diagnostics = await validateFiles({
    'core.json': { color: { base: { $vaule: '#000000' } } },
  });

  expect(diagnostics).toHaveLength(1);
  expect(first(diagnostics).severity).toBe('error');
  expect(first(diagnostics).file).toBe('core.json');
  expect(first(diagnostics).pointer).toBe('/color/base');
  expect(first(diagnostics).message).toContain('$vaule');
});

test('$description must be a string, and the pointer names it', async () => {
  const diagnostics = await validateFiles({
    'core.json': { color: { base: { $value: '#000', $description: 5 } } },
  });

  expect(
    diagnostics.some((d) => d.pointer === '/color/base/$description'),
  ).toBe(true);
});

test('a name containing a reserved character is rejected', async () => {
  const diagnostics = await validateFiles({
    'core.json': { 'color.base': { $value: '#000' } },
  });

  expect(diagnostics.length).toBeGreaterThan(0);
  expect(first(diagnostics).code).toContain('schema/');
});

test('a node cannot be both a token and a group', async () => {
  const diagnostics = await validateFiles({
    'core.json': { color: { $value: '#000', base: { $value: '#fff' } } },
  });

  expect(diagnostics.length).toBeGreaterThan(0);
});

test('resolver files are checked against the resolver schema, not the token schema', async () => {
  const diagnostics = await validateFiles({
    'default.resolver.json': { version: '2025.10', sets: {}, modifiers: {} },
  });

  // `resolutionOrder` is required; the token schema would not have complained.
  expect(diagnostics).toHaveLength(1);
  expect(first(diagnostics).file).toBe('default.resolver.json');
  expect(first(diagnostics).code).toBe('schema/required');
});

test('a well-formed resolver passes', async () => {
  expect(
    await validateFiles({
      'default.resolver.json': {
        version: '2025.10',
        name: 'default',
        sets: { core: { sources: [{ $ref: 'core.json' }] } },
        modifiers: {},
        resolutionOrder: [{ $ref: '#/sets/core' }],
      },
    }),
  ).toEqual([]);
});

test('bindings are data: a caller can supply its own schema and severity', async () => {
  const diagnostics = await validateFiles({ 'core.json': { color: {} } }, [
    {
      match: '*',
      schema: { type: 'object', required: ['space'] },
      severity: 'warning',
      domain: 'house',
    },
  ]);

  expect(diagnostics).toHaveLength(1);
  expect(first(diagnostics).severity).toBe('warning');
  expect(first(diagnostics).code).toBe('house/required');
});

const HOUSE = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    color: {
      type: 'object',
      properties: {
        text: {
          type: 'object',
          properties: {
            neutral: { type: 'object' },
            brand: { type: 'object' },
            success: { type: 'object' },
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
};

test('a house schema layers over DTCG rather than replacing it', async () => {
  const diagnostics = await validateFiles(
    {
      'core.json': {
        color: {
          text: { neutral: { $vaule: '#000' }, bland: { $value: '#000' } },
        },
      },
    },
    [
      { match: '*', schema: DTCG_TOKEN_SCHEMA, domain: 'dtcg' },
      { match: '*', schema: HOUSE, domain: 'house' },
    ],
  );

  expect(diagnostics.some((d) => d.code.startsWith('dtcg/'))).toBe(true);
  expect(diagnostics.some((d) => d.code.startsWith('house/'))).toBe(true);
});

test('a resolver file is not checked against token bindings', async () => {
  expect(
    await validateFiles({
      'default.resolver.json': {
        version: '2025.10',
        sets: {},
        modifiers: {},
        resolutionOrder: [],
      },
    }),
  ).toEqual([]);
});

test('a closed-membership violation names the offender and what was allowed', async () => {
  const [diagnostic] = await validateFiles(
    { 'core.json': { color: { text: { bland: {} } } } },
    [{ match: '*', schema: HOUSE, domain: 'house' }],
  );

  expect(diagnostic?.pointer).toBe('/color/text');
  expect(diagnostic?.message).toContain("'bland'");
  expect(diagnostic?.message).toContain('neutral');
  expect(diagnostic?.message).toContain('success');
});

test('a schema that is not valid JSON Schema is reported, not thrown', async () => {
  const diagnostics = await validateFiles({ 'core.json': {} }, [
    { match: '*', schema: { type: 'nonsense' }, domain: 'broken' },
  ]);

  expect(diagnostics).toHaveLength(1);
  expect(diagnostics[0]?.code).toBe('schema/invalid-schema');
  expect(diagnostics[0]?.message).toContain('broken');
});

test('one invalid binding does not stop the others from running', async () => {
  const diagnostics = await validateFiles(
    { 'core.json': { color: { text: { bland: {} } } } },
    [
      { match: '*', schema: { type: 'nonsense' }, domain: 'broken' },
      { match: '*', schema: HOUSE, domain: 'house' },
    ],
  );

  expect(diagnostics.some((d) => d.code === 'schema/invalid-schema')).toBe(
    true,
  );
  expect(diagnostics.some((d) => d.code.startsWith('house/'))).toBe(true);
});

test('the allowed list shows the vocabulary, not DTCG structural keys', async () => {
  const withDtcgKeys = {
    type: 'object',
    properties: {
      $type: {},
      $description: {},
      neutral: {},
      brand: {},
    },
    additionalProperties: false,
  };

  const [byName] = await validateFiles({ 'core.json': { bland: {} } }, [
    { match: '*', schema: withDtcgKeys, domain: 'house' },
  ]);
  expect(byName?.message).toContain('neutral, brand');
  expect(byName?.message).not.toContain('$type');

  // …and the inverse: a mistyped DTCG key wants the DTCG keys, not the member names.
  const [byKey] = await validateFiles({ 'core.json': { $vaule: 1 } }, [
    { match: '*', schema: withDtcgKeys, domain: 'house' },
  ]);
  expect(byKey?.message).toContain('$type, $description');
  expect(byKey?.message).not.toContain('neutral');
});

test('a group root token is valid DTCG', async () => {
  const diagnostics = await validateFiles({
    'core.json': {
      color: {
        text: {
          $type: 'color',
          $root: { $value: '#000' },
          subtle: { $value: '#333' },
        },
      },
    },
  });
  expect(diagnostics).toEqual([]);
});

test('a token may not also carry a root token', async () => {
  const diagnostics = await validateFiles({
    'core.json': {
      color: { text: { $value: '#000', $root: { $value: '#111' } } },
    },
  });
  expect(diagnostics).toHaveLength(1);
  expect(diagnostics[0]?.severity).toBe('error');
});

test('a root token must be a token, not a group', async () => {
  const diagnostics = await validateFiles({
    'core.json': { color: { text: { $root: { subtle: { $value: '#333' } } } } },
  });
  expect(diagnostics.length).toBeGreaterThan(0);
});

test('a node with $value and members names the member, at the node', async () => {
  // REWRITTEN at the base swap: the retired subset reported this shape through its own
  // `dependentSchemas` construct ('schema/false schema' + a $root remedy). The published schema
  // reports it through the token branch's closure — the member's NAME at the node — and, because
  // the fixture's token is inline-typed, 2025.10's object-notation rule for dimensions fires too.
  const diagnostics = await validateFiles({
    'core.json': {
      border: {
        width: {
          $type: 'dimension',
          $value: '1px',
          outline: { $value: '2px' },
        },
      },
    },
  });

  expect(diagnostics).toHaveLength(2);
  const dual = diagnostics.find((d) => d.pointer === '/border/width');
  expect(dual?.code).toBe('schema/additionalProperties');
  expect(dual?.message).toContain("'outline' is not permitted");
  const value = diagnostics.find((d) => d.pointer === '/border/width/$value');
  expect(value?.code).toBe('schema/type');
  expect(value?.message).toContain('must be object');
});

test('a draft-07 binding validates under its declared dialect', async () => {
  // draft-07 tuple `items` — the exact construct that cannot compile under ajv-2020.
  const draft7 = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: 'test:tuple7',
    type: 'object',
    properties: {
      pair: { type: 'array', items: [{ type: 'number' }, { type: 'string' }] },
    },
  };
  const bindings = [
    { match: '*', target: 'tokens' as const, schema: draft7, domain: 'seven' },
  ];
  expect(
    await validateFiles({ 'core.json': { pair: [1, 'a'] } }, bindings),
  ).toEqual([]);
  const bad = await validateFiles(
    { 'core.json': { pair: ['a', 1] } },
    bindings,
  );
  expect(bad.length).toBeGreaterThan(0);
  expect(bad[0]?.code.startsWith('seven/')).toBe(true);
});

test('draft-07 and 2020-12 bindings coexist in one call', async () => {
  const draft7 = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
  };
  const modern = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    properties: { a: true },
    unevaluatedProperties: false,
  };
  const out = await validateFiles({ 'core.json': { b: 1 } }, [
    { match: '*', target: 'tokens', schema: draft7, domain: 'd7' },
    { match: '*', target: 'tokens', schema: modern, domain: 'd20' },
  ]);
  expect(out).toHaveLength(1);
  expect(out[0]?.code).toBe('d20/unevaluatedProperties');
});

test('curation: envelope keywords dropped, one diagnostic per location', async () => {
  const branchy = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    properties: {
      node: {
        oneOf: [
          { type: 'object', required: ['$value'], additionalProperties: false },
          {
            type: 'object',
            properties: { a: true },
            additionalProperties: false,
          },
        ],
      },
    },
  };
  const out = await validateFiles({ 'core.json': { node: { bogus: 1 } } }, [
    { match: '*', target: 'tokens', schema: branchy, domain: 'branchy' },
  ]);
  // Both oneOf branches fail and the envelope reports too — the author needs the sharpest error,
  // once, at the node.
  expect(out).toHaveLength(1);
  expect(out[0]?.code).toBe('branchy/additionalProperties');
  expect(out[0]?.pointer).toBe('/node');
});

test('curation: a broken descendant does not echo up as sibling noise', async () => {
  // One bad value, three levels deep. The base's token branch flags EVERY member of every
  // ancestor group ("'300' is not permitted…"), which is false advice. The author gets the one
  // real error, at the node that carries it.
  const diagnostics = await validateFiles({
    'core.json': {
      color: {
        gray: {
          $type: 'color',
          '100': { $value: '#f3f4f6' },
          '400': { $type: 'color', $value: '#9ca3af' },
        },
        neutral: { $type: 'color', base: { $value: '#111' } },
      },
    },
  });

  expect(diagnostics).toHaveLength(1);
  expect(diagnostics[0]?.pointer).toBe('/color/gray/400/$value');
  expect(diagnostics[0]?.message).toContain('must be object');
});
