import { expect, test } from 'vitest';
import { buildSchema } from './build-schema';

const NAMES = [
  'color.text.$root',
  'color.text.subtle',
  'color.text.accent.blue.$root',
  'color.text.accent.blue.bolder',
  'space.100',
];

async function compile(schema: object) {
  const { default: Ajv } = await import('ajv/dist/2020.js');
  return new Ajv({ allErrors: true, strict: false }).compile(schema);
}

test('names and order are enforced; representation is not', async () => {
  const validate = await compile(buildSchema(NAMES, { branch: 'color' }));

  // the granted tree, with group $type and a base value where the source records one
  expect(
    validate({
      color: {
        $type: 'color',
        text: { $root: { $value: '#000' }, subtle: { $value: '#111' } },
      },
    }),
  ).toBe(true);

  // Representation freedom, both directions: a base value at a position the source does NOT
  // record one for, and a granted interior name written as a bare token. (The old emitter's
  // closure refused both; the loosening is decision 2 of the regen spec — a vocabulary governs
  // names, never what a granted name IS.)
  expect(
    validate({ color: { text: { accent: { $root: { $value: '#0' } } } } }),
  ).toBe(true);
  expect(validate({ color: { text: { accent: { $value: '#0' } } } })).toBe(
    true,
  );

  // another branch passes untouched — aspects mix
  expect(validate({ space: { 100: { $value: '8px' } } })).toBe(true);

  // NAMES are still the law: an invented leaf, and a name past a terminus
  expect(validate({ color: { text: { bland: { $value: '#0' } } } })).toBe(
    false,
  );
  expect(
    validate({ color: { text: { subtle: { deeper: { $value: '#0' } } } } }),
  ).toBe(false);
});

test('the wholesale schema seals the root; an aspect leaves it open', async () => {
  const wholesale = await compile(buildSchema(NAMES, {}));
  expect(wholesale({ nonsense: { x: { $value: 1 } } })).toBe(false);

  const aspect = await compile(buildSchema(NAMES, { branch: 'color' }));
  expect(aspect({ nonsense: { x: { $value: 1 } } })).toBe(true);
});

test('an aspect carries only its own branch', () => {
  const schema = buildSchema(NAMES, { branch: 'color' }) as {
    properties: Record<string, unknown>;
  };
  expect(Object.keys(schema.properties)).toEqual(['color']);
});

test('emitted positions carry the one shape, nothing retired, nothing external', () => {
  const schema = JSON.stringify(buildSchema(NAMES, { branch: 'color' }));
  expect(schema).not.toContain('groupKeys');
  expect(schema).not.toContain('$ref');
  expect(schema).toContain('unevaluatedProperties');
});
