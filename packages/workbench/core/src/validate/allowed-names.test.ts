import { expect, test } from 'vitest';
import { allowedNamesAt } from './allowed-names';

const schema = {
  properties: {
    color: { properties: { text: { properties: { neutral: {}, brand: {} } } } },
  },
};

test('walks nested properties to the named level', () => {
  expect(allowedNamesAt(schema, '/color/text')).toEqual(['neutral', 'brand']);
  expect(allowedNamesAt(schema, '/color')).toEqual(['text']);
  expect(allowedNamesAt(schema, '')).toEqual(['color']);
});

test('returns undefined rather than guessing when the path is not walkable', () => {
  expect(allowedNamesAt(schema, '/color/nope')).toBeUndefined();
  expect(allowedNamesAt({ $ref: '#/$defs/node' }, '/color')).toBeUndefined();
  expect(allowedNamesAt(schema, '/color/text/neutral')).toBeUndefined();
});

test('decodes JSON Pointer escapes in a segment', () => {
  const escaped = { properties: { 'a/b': { properties: { ok: {} } } } };
  expect(allowedNamesAt(escaped, '/a~1b')).toEqual(['ok']);
});

test('follows allOf and local $ref, the way a hand-authored schema composes', () => {
  const composed = {
    $defs: { shared: { properties: { $type: {}, $description: {} } } },
    allOf: [{ $ref: '#/$defs/shared' }],
    properties: { color: { $ref: '#/$defs/leaf' } },
    $defs2: {},
  };
  // Names contributed through the $ref are part of the vocabulary, not invisible to it.
  expect(allowedNamesAt(composed, '')).toEqual([
    'color',
    '$type',
    '$description',
  ]);
});

test('a remote $ref degrades rather than guessing', () => {
  expect(
    allowedNamesAt(
      { properties: { a: { $ref: 'https://example.test/s' } } },
      '/a',
    ),
  ).toBeUndefined();
});

test('names come from the base AND the extension, not one of them', () => {
  // Both schemas describe `/color/text`. Collapsing them would silently pick a winner — which is
  // how the extension's own added name went missing while the message still looked plausible.
  const base = {
    $id: 'test:base',
    properties: {
      color: {
        properties: { text: { properties: { subtle: {}, bold: {} } } },
      },
    },
  };
  const extension = {
    $id: 'test:ext',
    allOf: [{ $ref: 'test:base' }],
    properties: {
      color: {
        allOf: [{ $ref: 'test:base#/properties/color' }],
        properties: {
          text: {
            allOf: [{ $ref: 'test:base#/properties/color/properties/text' }],
            properties: { marketing: {} },
          },
        },
      },
    },
  };

  expect(allowedNamesAt(extension, '/color/text', [base])?.sort()).toEqual([
    'bold',
    'marketing',
    'subtle',
  ]);
});

test('a local $ref inside a referenced document resolves in ITS document', () => {
  // Following a ref into a packaged schema and then resolving that schema's own `#/$defs/...`
  // against the REFERRING document finds nothing, and the base silently contributes no names.
  const base = {
    $id: 'test:base',
    $defs: { text: { properties: { subtle: {} } } },
    properties: { color: { properties: { text: { $ref: '#/$defs/text' } } } },
  };
  const extension = {
    $id: 'test:ext',
    properties: {
      color: {
        allOf: [{ $ref: 'test:base#/properties/color' }],
      },
    },
  };

  expect(allowedNamesAt(extension, '/color/text', [base])).toEqual(['subtle']);
});

test('an unreachable cross-file ref reports nothing rather than a partial list', () => {
  const extension = {
    $id: 'test:ext',
    properties: {
      color: { allOf: [{ $ref: 'test:missing#/properties/color' }] },
    },
  };
  // Registry is empty, so the base is unreachable: a short list here would read as the whole
  // vocabulary and send an author looking for a name that is in fact permitted.
  expect(allowedNamesAt(extension, '/color', [])).toBeUndefined();
});
