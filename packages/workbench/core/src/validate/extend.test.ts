import { expect, test } from 'vitest';
import { assembleBindings } from './assemble';
import { DTCG_TOKEN_SCHEMA } from './dtcg-schema';
import { anchorsOf, applyPatches } from './extend';
import { defaultBindings, type SchemaBinding, validateFiles } from './schema';

const TOKEN_TYPE =
  'https://www.designtokens.org/schemas/2025.10/format/tokenType.json';

function textDecorationPatch(): SchemaBinding {
  return {
    match: '*',
    target: 'tokens',
    domain: 'text-decoration',
    origin: 'extension',
    schema: {
      $extends: {
        'dtcg#tokenType': { enum: ['textDecoration'] },
        'dtcg#token': {
          allOf: [
            {
              if: {
                properties: { $type: { const: 'textDecoration' } },
                required: ['$type'],
              },
              // biome-ignore lint/suspicious/noThenProperty: JSON Schema's `then` keyword, not a thenable
              then: {
                properties: {
                  $value: {
                    anyOf: [
                      { enum: ['none', 'underline', 'line-through'] },
                      { $ref: 'dtcg#tokenValueReference' },
                    ],
                  },
                },
              },
            },
          ],
        },
        'dtcg#typographyValue': {
          properties: { textDecoration: { type: 'string' } },
        },
      },
    },
  };
}

test('anchors derive from plain names and spec URLs', () => {
  const anchors = anchorsOf(DTCG_TOKEN_SCHEMA);
  for (const name of [
    'curlyBraceReference',
    'tokenValueReference',
    'tokenType',
    'token',
    'group',
    'typographyValue',
    'dimensionValue',
  ]) {
    expect(anchors.has(name), name).toBe(true);
  }
});

test('applyPatches merges with union/append semantics into a clone of the effective schema', () => {
  const effective = structuredClone(DTCG_TOKEN_SCHEMA) as Record<
    string,
    // biome-ignore lint/suspicious/noExplicitAny: raw JSON schema surgery in a test
    any
  >;
  const before = effective.definitions[TOKEN_TYPE].enum.length;
  const beforeAllOf =
    effective.definitions[
      'https://www.designtokens.org/schemas/2025.10/format/token.json'
    ].allOf.length;

  const diagnostics = applyPatches(effective, [
    { document: textDecorationPatch().schema, label: 'test' },
  ]);
  expect(diagnostics).toEqual([]);
  // enum UNIONED, not replaced; allOf APPENDED.
  expect(effective.definitions[TOKEN_TYPE].enum).toHaveLength(before + 1);
  expect(effective.definitions[TOKEN_TYPE].enum).toContain('textDecoration');
  expect(
    effective.definitions[
      'https://www.designtokens.org/schemas/2025.10/format/token.json'
    ].allOf,
  ).toHaveLength(beforeAllOf + 1);
  // The compound gained a member; the existing members survive.
  const typography =
    effective.definitions[
      'https://www.designtokens.org/schemas/2025.10/format/values/typography.json'
    ];
  expect(Object.keys(typography.properties)).toContain('textDecoration');
  expect(Object.keys(typography.properties)).toContain('fontFamily');
});

test('unknown targets and structural keys beside $extends are diagnostics, never silent', () => {
  const effective = structuredClone(DTCG_TOKEN_SCHEMA);
  const bad = applyPatches(effective, [
    { document: { $extends: { 'dtcg#nope': {} } }, label: 'a' },
    {
      document: { $extends: { 'dtcg#token': {} }, properties: {} },
      label: 'b',
    },
  ]);
  expect(bad.map((d) => d.code)).toEqual([
    'schema/unknown-extend-target',
    'schema/unknown-extend-target',
  ]);
  expect(bad[0]?.message).toContain("unknown $extends target 'dtcg#nope'");
  expect(bad[1]?.message).toContain('remove: properties');
});

test('an extended type validates end to end, and dtcg# refs resolve from author schemas', async () => {
  const assembled = assembleBindings([
    ...defaultBindings(),
    textDecorationPatch(),
  ]);
  expect(assembled.diagnostics).toEqual([]);

  const files = {
    'core.json': {
      text: {
        ok: { $type: 'textDecoration', $value: 'underline' },
        alias: { $type: 'textDecoration', $value: '{text.ok}' },
        typography: {
          $type: 'typography',
          $value: {
            fontFamily: 'Inter',
            fontSize: { value: 1, unit: 'rem' },
            fontWeight: 400,
            letterSpacing: { value: 0, unit: 'px' },
            lineHeight: 1.5,
            textDecoration: 'underline',
          },
        },
      },
    },
  };
  expect(
    await validateFiles(files, assembled.bindings, assembled.referenced),
  ).toEqual([]);

  // A bad extended value is refused at the exact pointer by the PATCHED dtcg binding.
  const bad = await validateFiles(
    {
      'core.json': {
        text: { bad: { $type: 'textDecoration', $value: 'sparkle' } },
      },
    },
    assembled.bindings,
    assembled.referenced,
  );
  expect(bad.length).toBeGreaterThan(0);
  expect(bad.some((d) => d.pointer?.includes('/text/bad'))).toBe(true);

  // An unknown type is still refused — the enum was unioned, not opened.
  const unknown = await validateFiles(
    {
      'core.json': { x: { $type: 'sparkleType', $value: 1 } },
    },
    assembled.bindings,
    assembled.referenced,
  );
  expect(unknown.length).toBeGreaterThan(0);
});

test('assembly resolves ids across routes last-wins and reports patches without a dtcg binding', () => {
  const replacement: SchemaBinding = {
    id: 'dtcg-tokens',
    match: '*',
    target: 'tokens',
    schema: { type: 'object' },
    origin: 'extension',
  };
  const assembled = assembleBindings([...defaultBindings(), replacement]);
  const dtcg = assembled.bindings.find((b) => b.id === 'dtcg-tokens');
  expect(dtcg?.origin).toBe('extension');

  const orphan = assembleBindings([textDecorationPatch()]);
  expect(orphan.diagnostics[0]?.code).toBe('schema/unknown-extend-target');
  expect(orphan.diagnostics[0]?.message).toContain("no 'dtcg-tokens' binding");
});
