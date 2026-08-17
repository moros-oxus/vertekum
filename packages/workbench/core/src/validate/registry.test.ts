import { expect, test } from 'vitest';
import { createValidatorRegistry } from './registry';

test('the validator registry lists registrations in order', () => {
  const registry = createValidatorRegistry();
  registry.register({ id: 'a', name: 'A', validate: () => [] });
  registry.register({ id: 'b', name: 'B', validate: () => [] });
  expect(registry.list().map((v) => v.id)).toEqual(['a', 'b']);
});

test('re-registering an id replaces it', () => {
  const registry = createValidatorRegistry();
  registry.register({ id: 'a', name: 'A', validate: () => [] });
  registry.register({ id: 'a', name: 'A2', validate: () => [] });
  expect(registry.list()).toHaveLength(1);
  expect(registry.list()[0]?.name).toBe('A2');
});
