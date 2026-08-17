import type { ExporterInput, Token } from '@vertekum/core';
import { expect, test } from 'vitest';
import { cssExporter } from './css';

const t = (path: string[], value: unknown): Token => ({
  id: path.join('.'),
  path,
  type: 'color',
  value,
  set: 's',
});
const input = (
  base: Token[],
  variants: ExporterInput['variants'],
): ExporterInput => ({
  base,
  variants,
  resolver: {
    version: '2025.10',
    sets: {},
    modifiers: {},
    resolutionOrder: [],
  },
  tokens: base,
});

test('cssExporter emits one file: :root + a differing-only [data-theme] block, refs as var()', async () => {
  const files = (await cssExporter.transform(
    input(
      [
        t(['color', 'bg'], '#fff'),
        t(['color', 'link'], '{color.bg}'),
        t(['color', 'accent'], '#f80'),
      ],
      [
        {
          modifier: 'theme',
          context: 'dark',
          tokens: [t(['color', 'bg'], '#111'), t(['color', 'accent'], '#f80')],
        },
      ],
    ),
  )) as { path: string; content: string }[];
  expect(files).toHaveLength(1);
  expect(files[0]?.path).toBe('tokens.css');
  const css = files[0]?.content ?? '';
  expect(css).toContain(':root {');
  expect(css).toContain('--color-bg: #fff;');
  expect(css).toContain('--color-link: var(--color-bg);');
  const dark = css.slice(css.indexOf('[data-theme="dark"]'));
  expect(dark).toContain('--color-bg: #111;');
  expect(dark).not.toContain('--color-accent'); // unchanged → omitted
});

test('$root exports under the group name, and references to it match', async () => {
  const files = (await cssExporter.transform(
    input(
      [
        t(['color', 'text', '$root'], '#172B4D'),
        t(['color', 'text', 'subtle'], '#44546F'),
        t(['color', 'link', '$root'], '{color.text.$root}'),
      ],
      [],
    ),
  )) as { path: string; content: string }[];
  const css = files[0]?.content ?? '';

  // The group's own value takes the group's name — `$root` is DTCG storage, not a public name.
  expect(css).toContain('--color-text: #172B4D;');
  expect(css).toContain('--color-text-subtle: #44546F;');
  expect(css).not.toContain('$root');
  // A reference must resolve to the name the declaration actually used.
  expect(css).toContain('--color-link: var(--color-text);');
});

const MAGENTA = {
  colorSpace: 'oklch',
  components: [0.7017, 0.3225, 328.3634],
  alpha: 1,
  hex: '#ff00ff',
};

test('object values render in the FIXED default space — oklch, whatever storage holds', async () => {
  const files = (await cssExporter.transform(
    input(
      [
        t(['color', 'magenta'], MAGENTA),
        // stored in srgb: the default target CONVERTS it, so delivery never drifts with storage
        t(['color', 'red'], {
          colorSpace: 'srgb',
          components: [1, 0, 0],
          alpha: 1,
          hex: '#ff0000',
        }),
        t(['color', 'faded'], { ...MAGENTA, alpha: 0.5 }),
        t(['space', 'sm'], { value: 4, unit: 'px' }),
        t(['motion', 'fast'], { value: 200, unit: 'ms' }),
      ],
      [],
    ),
  )) as { content: string }[];
  const css = files[0]?.content ?? '';

  expect(css).toContain('--color-magenta: oklch(0.7017 0.3225 328.3634);');
  expect(css).toMatch(/--color-red: oklch\(0\.628 0\.2577 29\.2339\)/);
  expect(css).toContain('/ 0.5');
  expect(css).toContain('--space-sm: 4px;');
  expect(css).toContain('--motion-fast: 200ms;');
  expect(css).not.toContain('[object Object]');
});

test('colorFormat hex emits #rrggbb computed from components', async () => {
  const files = (await cssExporter
    .transform(input([t(['color', 'magenta'], MAGENTA)], []))
    .then((f) => f)) as { content: string }[];

  const hexFiles = (await cssExporter.transform({
    ...input([t(['color', 'magenta'], MAGENTA)], []),
    options: { colorFormat: 'hex' },
  } as never)) as { content: string }[];

  expect(files[0]?.content).toContain('oklch(');
  expect(hexFiles[0]?.content).toContain('--color-magenta: #ff00ff;');
});

test('colorSpace display-p3 emits the color() function form', async () => {
  const files = (await cssExporter.transform({
    ...input([t(['color', 'magenta'], MAGENTA)], []),
    options: { colorSpace: 'display-p3' },
  } as never)) as { content: string }[];
  expect(files[0]?.content).toMatch(/--color-magenta: color\(display-p3 /);
});
