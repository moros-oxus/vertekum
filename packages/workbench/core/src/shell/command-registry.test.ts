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

test('extend joins the chain of an existing command, in order', () => {
  const registry = createCommandRegistry();
  registry.register({ name: 'token add', description: '', run() {} });
  const first = { handle: () => undefined };
  const second = { handle: () => undefined };

  registry.extend('token add', first);
  registry.extend('token add', second);

  expect(registry.extensionsOf('token add')).toEqual([first, second]);
  expect(registry.extensionsOf('token remove')).toEqual([]);
});

test('extending an unknown command is a loud activation error', () => {
  const registry = createCommandRegistry();
  registry.register({ name: 'token add', description: '', run() {} });

  expect(() =>
    registry.extend('token ad', { handle: () => undefined }),
  ).toThrow(/cannot extend 'token ad'/);
});

test('build is extensible without being a registered command', () => {
  const registry = createCommandRegistry();
  const link = { handle: () => undefined };

  registry.extend('build', link);

  expect(registry.extensionsOf('build')).toEqual([link]);
});
