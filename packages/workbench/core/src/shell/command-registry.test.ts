import { expect, test } from 'vitest';
import { createCommandRegistry } from './command-registry';

const noop = { description: 'x', run: () => {} };

test('the registry lists registrations in order', () => {
  const registry = createCommandRegistry();
  registry.register({ name: 'token rename', ...noop });
  registry.register({ name: 'token move', ...noop });
  expect(registry.list().map((c) => c.name)).toEqual([
    'token rename',
    'token move',
  ]);
});

test('a duplicate name is refused at registration', () => {
  const registry = createCommandRegistry();
  registry.register({ name: 'token rename', ...noop });
  expect(() => registry.register({ name: 'token rename', ...noop })).toThrow(
    /already registered/,
  );
});
