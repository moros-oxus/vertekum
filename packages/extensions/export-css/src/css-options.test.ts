import type { Token } from '@vertekum/core';
import { expect, test } from 'vitest';
import { cssExporter } from './css';

const t = (path: string[], value: unknown, set: string): Token => ({
  id: `${set}:${path.join('.')}`,
  path,
  type: 'color',
  value,
  set,
});
const input = {
  base: [t(['color', 'bg'], '#fff', 'light')],
  variants: [
    {
      modifier: 'theme',
      context: 'dark',
      tokens: [t(['color', 'bg'], '#111', 'dark')],
    },
  ],
  resolver: {
    version: '2025.10',
    sets: {},
    modifiers: {},
    resolutionOrder: [],
  },
  tokens: [],
};

test('css exporter defaults to one file with attribute selectors', async () => {
  const files = await cssExporter.transform(input as never);
  expect(files).toHaveLength(1);
  expect(files[0]?.path).toBe('tokens.css');
  expect(files[0]?.content).toContain('[data-theme="dark"]');
});

test('css exporter honours the media selector strategy', async () => {
  const files = await cssExporter.transform({
    ...input,
    options: { selector: 'media' },
  } as never);
  expect(files[0]?.content).toContain('@media (prefers-color-scheme: dark)');
  expect(files[0]?.content).not.toContain('[data-theme="dark"]');
});

test('css exporter emits one file per variant under the files strategy', async () => {
  const files = await cssExporter.transform({
    ...input,
    options: { selector: 'files', fileName: 'vars.css' },
  } as never);
  expect(files.map((f) => f.path)).toEqual(['vars.css', 'theme-dark.vars.css']);
});

test('css exporter declares its options schema', () => {
  expect(
    cssExporter.optionsSchema?.safeParse({ selector: 'nope' }).success,
  ).toBe(false);
  expect(cssExporter.optionsSchema?.safeParse({}).success).toBe(true);
});
