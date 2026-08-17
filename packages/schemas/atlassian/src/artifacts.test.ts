import { expect, test } from 'vitest';
import atlassian from '../atlassian.json';
import color from '../color.json';
import space from '../space.json';
import { buildSchema } from './build-schema';
import vocabulary from './vocabulary.json';

/** The shipped files are what a consumer binds — a stale artifact must fail, not the builder. */
async function ajv() {
  const { default: Ajv } = await import('ajv/dist/2020.js');
  return new Ajv({ allErrors: true, strict: false });
}

test('derive is byte-stable: fresh emission equals the committed artifacts', () => {
  expect(buildSchema(vocabulary.names, { branch: 'color' })).toEqual(color);
  expect(buildSchema(vocabulary.names, { branch: 'space' })).toEqual(space);
  expect(buildSchema(vocabulary.names, {})).toEqual(atlassian);
});

test('every shipped schema compiles under 2020-12', async () => {
  const instance = await ajv();
  for (const schema of [color, space, atlassian]) {
    expect(() => instance.compile(schema)).not.toThrow();
  }
});

test('the shipped color aspect enforces names and order, not representation', async () => {
  const instance = await ajv();
  const validate = instance.compile(color);

  expect(
    validate({
      color: {
        $type: 'color',
        text: { $root: { $value: '#172B4D' }, subtle: { $value: '#44546F' } },
      },
    }),
  ).toBe(true);
  // representation freedom at a granted name
  expect(validate({ color: { text: { accent: { $value: '#0' } } } })).toBe(
    true,
  );
  // names remain the law
  expect(validate({ color: { text: { bland: { $value: '#0' } } } })).toBe(
    false,
  );
  expect(
    validate({ color: { text: { subtle: { deeper: { $value: '#0' } } } } }),
  ).toBe(false);
  // another aspect's branch passes untouched
  expect(validate({ space: { 100: { $value: '8px' } } })).toBe(true);
});

test('two aspects bound together produce no cross-aspect false errors', async () => {
  const instance = await ajv();
  const colorValidate = instance.compile(color);
  const spaceValidate = instance.compile(space);
  const doc = {
    color: { text: { subtle: { $value: '#333' } } },
    space: { 100: { $value: '8px' } },
  };
  expect(colorValidate(doc)).toBe(true);
  expect(spaceValidate(doc)).toBe(true);
});

test('the wholesale schema seals the root', async () => {
  const instance = await ajv();
  const validate = instance.compile(atlassian);
  expect(validate({ nonsense: { x: { $value: 1 } } })).toBe(false);
});
