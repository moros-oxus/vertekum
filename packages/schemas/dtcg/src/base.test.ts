import { expect, test } from 'vitest';
import base from '../format.json';

test('the base is the published schema: canonical $id, draft-07, untouched shape', () => {
  const b = base as Record<string, unknown>;
  expect(b.$id).toBe(
    'https://www.designtokens.org/schemas/2025.10/format.json',
  );
  expect(b.$schema).toBe('http://json-schema.org/draft-07/schema#');
  // the published file inlines its sibling documents as URL-keyed definitions — 22 of them
  expect(Object.keys(b.definitions as object)).toHaveLength(22);
});

async function compile() {
  // The base is draft-07 and MUST be validated by a draft-07 instance — its tuple-form `items`
  // does not even compile under ajv's 2020-12 entry point. Consumers must pick the validator
  // dialect from each schema's declared `$schema`.
  const { default: Ajv } = await import('ajv');
  return new Ajv({ allErrors: true, strict: false, logger: false }).compile(
    base,
  );
}

test('accepts what the spec permits', async () => {
  const validate = await compile();
  const accepted = [
    // group-typed token: per-type value rules key on INLINE $type only, so this is vacuous —
    // the recorded limitation that keeps legacy string values passing
    { color: { $type: 'color', a: { $value: '#fff' } } },
    {
      color: {
        a: {
          $type: 'color',
          $value: {
            colorSpace: 'srgb',
            components: [1, 1, 1],
            alpha: 1,
            hex: '#ffffff',
          },
        },
      },
    },
    { color: { $root: { $value: '#000' }, subtle: { $value: '#111' } } },
    { color: { a: { $ref: '#/color/b' }, b: { $value: '#fff' } } },
    { color: { a: { $value: '{color.b}' }, b: { $value: '#fff' } } },
    {
      $schema: 'https://www.designtokens.org/schemas/2025.10/format.json',
      color: { a: { $value: '#fff' } },
    },
  ];
  for (const doc of accepted) {
    expect(validate(doc), JSON.stringify(doc)).toBe(true);
  }
});

test('refuses what the spec forbids', async () => {
  const validate = await compile();
  const refused = [
    { color: { a: { $type: 'color', $value: '#fff' } } }, // inline type fires object-notation colours
    { color: { a: { $vaule: '#fff' } } },
    { color: { a: { $value: '#fff', b: { $value: 1 } } } }, // token AND group
    { color: { a: 42 } }, // a node must be an object
    { color: { a: [1] } },
    { $value: '#fff' }, // a document root is a group
    { color: { 'bad.name': { $value: 1 } } }, // reserved characters
  ];
  for (const doc of refused) {
    expect(validate(doc), JSON.stringify(doc)).toBe(false);
  }
});
