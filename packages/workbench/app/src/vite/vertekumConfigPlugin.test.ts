import { afterEach, expect, test } from 'vitest';
import { vertekumConfigPlugin } from './vertekumConfigPlugin';

afterEach(() => {
  delete process.env.VERTEKUM_CONFIG;
});

test('resolveId maps the virtual id to an internal resolved id', () => {
  const plugin = vertekumConfigPlugin();
  const resolve = plugin.resolveId as (id: string) => string | undefined;
  expect(resolve('virtual:vertekum-config')).toBe('\0virtual:vertekum-config');
  expect(resolve('something-else')).toBeUndefined();
});

test('load re-exports the default in-repo config when VERTEKUM_CONFIG is unset', () => {
  const plugin = vertekumConfigPlugin();
  const load = plugin.load as (id: string) => string | undefined;
  const code = load('\0virtual:vertekum-config');
  expect(code).toContain('export { default }');
  expect(code).toContain('vertekum.config');
});

test('load re-exports the config named by VERTEKUM_CONFIG', () => {
  process.env.VERTEKUM_CONFIG = '/proj/vertekum.config.ts';
  const plugin = vertekumConfigPlugin();
  const load = plugin.load as (id: string) => string | undefined;
  expect(load('\0virtual:vertekum-config')).toContain(
    '/proj/vertekum.config.ts',
  );
});
