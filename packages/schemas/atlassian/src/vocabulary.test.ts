import { expect, test } from 'vitest';
import vocabulary from './vocabulary.json';

test('the committed vocabulary has the expected shape and size', () => {
  expect(vocabulary.source).toBe('@atlaskit/tokens');
  expect(vocabulary.names).toHaveLength(570);
  expect(vocabulary.dropped).toHaveLength(3);
});

test('names are sorted and unique', () => {
  const sorted = [...vocabulary.names].sort();
  expect(vocabulary.names).toEqual(sorted);
  expect(new Set(vocabulary.names).size).toBe(vocabulary.names.length);
});

test('no product-specific name survived the drop list', () => {
  for (const name of vocabulary.names) {
    expect(name.startsWith('color.rovo.')).toBe(false);
    expect(name.startsWith('elevation.rovo.')).toBe(false);
    expect(name.startsWith('utility.UNSAFE.')).toBe(false);
  }
});

test('every name that is a prefix of another ends in $root', () => {
  // The DTCG rule this encoding exists to satisfy: no name may be both a token and a group.
  const bare = vocabulary.names.map((n) => n.replace(/\.\$root$/, ''));
  const rooted = new Set(
    vocabulary.names
      .filter((n) => n.endsWith('.$root'))
      .map((n) => n.slice(0, -'.$root'.length)),
  );
  for (const name of bare) {
    const isPrefix = bare.some(
      (other) => other !== name && other.startsWith(`${name}.`),
    );
    if (isPrefix) expect(rooted.has(name)).toBe(true);
  }
  expect(rooted.size).toBe(160);
});

test('$root appears only as a final segment', () => {
  for (const name of vocabulary.names) {
    const roots = name.split('.').filter((s) => s === '$root');
    expect(roots.length).toBeLessThanOrEqual(1);
    if (roots.length === 1) expect(name.endsWith('.$root')).toBe(true);
  }
});
