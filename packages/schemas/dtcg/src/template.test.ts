import { expect, test } from 'vitest';
import base from '../format.json';
import terminus from '../template/token.terminus.json';
import denotations from '../template/tokens.denotations.json';
import vocabulary from '../template/tokens.vocabulary.json';

async function validators() {
  const { default: Ajv2020 } = await import('ajv/dist/2020.js');
  const { default: Ajv7 } = await import('ajv');
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  // Registering the referenced files is all the resolution the relative refs need: each resolves
  // against its referrer's $id to a registered $id — no filesystem required. The shared URI
  // directory in the $ids is what makes the same files work file-relatively in any loader too.
  ajv.addSchema(denotations);
  ajv.addSchema(terminus);
  return {
    vocab: ajv.compile(vocabulary),
    base: new Ajv7({ allErrors: true, strict: false, logger: false }).compile(
      base,
    ),
  };
}

const legal = {
  color: {
    $type: 'color',
    text: {
      $description: 'Text colours',
      $root: { $value: '#111827' },
      subtle: { $value: '#6b7280' },
      brand: {
        default: { $value: '{color.text.$root}' },
        bold: { $value: '#1d4ed8' },
      },
    },
    background: { default: { $value: '#ffffff' } },
  },
};

test('the legal document passes BOTH parallel schemas', async () => {
  const { vocab, base: baseValidate } = await validators();
  expect(vocab(legal)).toBe(true);
  expect(baseValidate(legal)).toBe(true);
});

test('violations land at their exact position', async () => {
  const { vocab } = await validators();
  const cases: Array<[object, string, string]> = [
    [{ color: { text: { bland: { $value: '#0' } } } }, '/color/text', 'bland'],
    [
      { color: { text: { brand: { shiny: { $value: '#0' } } } } },
      '/color/text/brand',
      'shiny',
    ],
    [
      { color: { background: { brand: { bold: { $value: '#0' } } } } },
      '/color/background',
      'brand',
    ],
    [{ nonsense: { x: { $value: 1 } } }, '', 'nonsense'],
  ];
  for (const [doc, where, name] of cases) {
    expect(vocab(doc)).toBe(false);
    const err = (vocab.errors ?? []).find(
      (e) => e.keyword === 'unevaluatedProperties',
    );
    expect(err?.instancePath, JSON.stringify(doc)).toBe(where);
    expect(err?.params?.unevaluatedProperty).toBe(name);
  }
});

test('a group at a terminus fails on the missing $value', async () => {
  const { vocab } = await validators();
  expect(
    vocab({ color: { text: { subtle: { deeper: { $value: '#0' } } } } }),
  ).toBe(false);
  const err = (vocab.errors ?? []).find((e) => e.keyword === 'required');
  expect(err?.instancePath).toBe('/color/text/subtle');
  expect(err?.params?.missingProperty).toBe('$value');
});

test('the FORMAT schema catches what the vocabulary passes through', async () => {
  const { vocab, base: baseValidate } = await validators();
  const typo = {
    color: {
      $type: 'color',
      text: { $vaule: '#000', subtle: { $value: '#0' } },
    },
  };
  // the $-passthrough accepts $vaule unjudged — judging $-keys is the format schema's job
  expect(vocab(typo)).toBe(true);
  expect(baseValidate(typo)).toBe(false);
});
