import { resolveVertekumConfig } from '@vertekum/core';
import { expect, test } from 'vitest';
import { loadDefaultConfig } from './defaultConfig';

test('with the app installed, the system default is the app host config', async () => {
  const config = resolveVertekumConfig(await loadDefaultConfig(), {
    command: 'build',
    mode: 'production',
  });
  expect(config.extensions?.length).toBeGreaterThan(0);
});

test('an absent app falls back to the empty config', async () => {
  const missing = Object.assign(new Error('not found'), {
    code: 'ERR_MODULE_NOT_FOUND',
  });
  await expect(
    loadDefaultConfig(() => Promise.reject(missing)),
  ).resolves.toEqual({});
});

test('an unexported subpath falls back to the empty config', async () => {
  const unexported = Object.assign(new Error('no such subpath'), {
    code: 'ERR_PACKAGE_PATH_NOT_EXPORTED',
  });
  await expect(
    loadDefaultConfig(() => Promise.reject(unexported)),
  ).resolves.toEqual({});
});

test('an app that is present but broken surfaces its error', async () => {
  const broken = new Error('SyntaxError in default config');
  await expect(loadDefaultConfig(() => Promise.reject(broken))).rejects.toThrow(
    'SyntaxError in default config',
  );
});
