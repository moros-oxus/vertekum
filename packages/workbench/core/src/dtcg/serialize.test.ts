import { describe, expect, test } from 'vitest';
import { parseCollection } from './parse';
import { DEFAULT_SET, serializeCollection, serializeSets } from './serialize';

describe('serializeCollection', () => {
  test('serializes tokens into a nested DTCG tree, writing no identity', () => {
    expect(
      serializeCollection([
        {
          id: 'core:color.primary',
          path: ['color', 'primary'],
          type: 'color',
          value: '#f00',
        },
      ]),
    ).toEqual({
      color: {
        primary: {
          $type: 'color',
          $value: '#f00',
        },
      },
    });
  });

  test('omits $extensions entirely when a token has none', () => {
    const out = serializeCollection([
      { id: 'core:a', path: ['a'], type: 'color', value: '#f00' },
    ]);
    expect(Object.keys(out.a as object)).toEqual(['$type', '$value']);
  });

  test('round-trips org.vertekum.meta through parse', () => {
    const tokens = parseCollection({
      'x.json': {
        color: {
          primary: {
            $type: 'color',
            $value: '#f00',
            $extensions: { 'org.vertekum.meta': { note: 'hi' } },
          },
        },
      },
    });

    const reparsed = parseCollection({ 'x.json': serializeCollection(tokens) });

    expect(reparsed).toEqual(tokens);
  });

  test('emits $description and round-trips it through parse', () => {
    const node = serializeCollection([
      {
        id: 'id-1',
        path: ['color', 'primary'],
        type: 'color',
        value: '#f00',
        description: 'brand accent',
      },
    ]);

    const primary = (node.color as Record<string, Record<string, unknown>>)
      ?.primary;
    expect(primary?.$description).toBe('brand accent');

    const reparsed = parseCollection({ 'x.json': node });
    expect(reparsed[0]?.description).toBe('brand accent');
  });

  test('round-trips cleanly through parse (minted ids)', () => {
    const tokens = parseCollection({
      'x.json': { color: { primary: { $type: 'color', $value: '#f00' } } },
    });

    const reparsed = parseCollection({ 'x.json': serializeCollection(tokens) });

    expect(reparsed).toEqual(tokens);
  });

  test('preserves non-vertekum vendor extensions across a round-trip', () => {
    const tokens = parseCollection({
      'x.json': {
        color: {
          primary: {
            $type: 'color',
            $value: '#f00',
            $extensions: { 'com.acme': { foo: 1 } },
          },
        },
      },
    });

    const reparsed = parseCollection({ 'x.json': serializeCollection(tokens) });

    expect(reparsed).toEqual(tokens);
  });
});

describe('serializeSets', () => {
  test('writes one file per set, keyed by the set name plus .json', () => {
    const files = serializeSets([
      {
        id: 'a',
        path: ['color', 'a'],
        type: 'color',
        value: '#f00',
        set: 'core',
      },
      {
        id: 'b',
        path: ['color', 'b'],
        type: 'color',
        value: '#0f0',
        set: 'brand',
      },
    ]);
    expect(Object.keys(files).sort()).toEqual(['brand.json', 'core.json']);
    expect(files['core.json']).toEqual({
      color: { a: { $type: 'color', $value: '#f00' } },
    });
  });

  test('routes a token with no set to the default set file', () => {
    const files = serializeSets([
      { id: 'a', path: ['color', 'a'], type: 'color', value: '#f00' },
    ]);
    expect(Object.keys(files)).toEqual([`${DEFAULT_SET}.json`]);
  });

  test('round-trips ids, paths, values, and set across two files', () => {
    const tokens = parseCollection({
      'core.json': { color: { a: { $type: 'color', $value: '#f00' } } },
      'brand.json': { color: { b: { $type: 'color', $value: '#0f0' } } },
    });
    const reparsed = parseCollection(serializeSets(tokens));
    expect(reparsed).toEqual(tokens);
  });

  test('emits an empty file for a seeded set with no tokens', () => {
    const files = serializeSets(
      [
        {
          id: 'a',
          path: ['color', 'a'],
          type: 'color',
          value: '#f00',
          set: 'core',
        },
      ],
      ['core', 'empty'],
    );
    expect(Object.keys(files).sort()).toEqual(['core.json', 'empty.json']);
    expect(files['empty.json']).toEqual({});
  });
});
