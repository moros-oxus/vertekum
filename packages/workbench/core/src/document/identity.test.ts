import { expect, test } from 'vitest';
import { parseTokenId, tokenId } from './identity';

test('an id round-trips its set and path', () => {
  const id = tokenId('light', ['color', 'brand', 'primary']);
  expect(id).toBe('light:color.brand.primary');
  expect(parseTokenId(id)).toEqual({
    set: 'light',
    path: ['color', 'brand', 'primary'],
  });
});

test('the same path in different sets yields different ids', () => {
  expect(tokenId('light', ['surface', 'page'])).not.toBe(
    tokenId('dark', ['surface', 'page']),
  );
});

test('a malformed id is refused rather than silently mis-split', () => {
  expect(() => parseTokenId('surface.page')).toThrow(/malformed/);
});
