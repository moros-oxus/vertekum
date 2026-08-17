import { expect, test } from 'vitest';
import { createDocument } from '../document/document';
import { serializeDocument } from '../storage/provider';
import { parseCollection } from './parse';

/**
 * A themed collection overrides the same path in several sets — that is what sets are for. Identity
 * used to be a hash of the path alone, so those overrides collided in the document's id-keyed map
 * and one was silently discarded. `examples/unabridged` only escaped it because someone hand-authored
 * distinct idents into light.json and dark.json.
 */
test('two sets overriding one path both survive, with no idents present', () => {
  const files = {
    'light.json': { surface: { $type: 'color', page: { $value: '#ffffff' } } },
    'dark.json': { surface: { $type: 'color', page: { $value: '#141414' } } },
  };

  const tokens = parseCollection(files);
  expect(tokens).toHaveLength(2);

  const document = createDocument();
  document.hydrate(serializeDocument(tokens, ['light', 'dark'], new Map()));

  const values = document
    .getAllTokens()
    .map((t) => `${t.set}=${String(t.value)}`)
    .sort();
  expect(values).toEqual(['dark=#141414', 'light=#ffffff']);
});
