// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type {
  ExtensionContext,
  ResolverDocument,
  ScopedConfig,
  Target,
  Token,
} from 'vertekum';
import { createExporterRegistry } from 'vertekum/core';
import { afterEach, expect, test, vi } from 'vitest';
import { ExportRoute } from './ExportRoute';
import { writeOutputFile } from './write-output';

vi.mock('./write-output', () => ({ writeOutputFile: vi.fn(async () => {}) }));
afterEach(cleanup);

const resolver: ResolverDocument = {
  version: '2025.10',
  sets: { core: { sources: [{ $ref: 'core.json' }] } },
  modifiers: {
    theme: {
      contexts: {
        light: [{ $ref: 'light.json' }],
        dark: [{ $ref: 'dark.json' }],
      },
      default: 'light',
    },
  },
  resolutionOrder: [{ $ref: '#/sets/core' }, { $ref: '#/modifiers/theme' }],
};
const tk = (path: string[], value: unknown, set: string): Token => ({
  id: `${set}:${path.join('.')}`,
  path,
  type: 'color',
  value,
  set,
});
const tokens: Token[] = [
  tk(['color', 'bg'], '#fff', 'light'),
  tk(['color', 'bg'], '#111', 'dark'),
];

/** A ScopedConfig over a fixed target list — what `vtk.export`'s settings hand the route. */
function fakeConfig(targets: Target[]): ScopedConfig<{ targets: Target[] }> {
  const value = { targets };
  return { get: () => value, subscribe: () => () => {} };
}

function fakeContext(): ExtensionContext {
  const registry = createExporterRegistry();
  // A stub exporter — the real CSS exporter lives in @vertekum/ext-export-css; the route only
  // needs SOMETHING registered.
  registry.register({
    id: 'css',
    name: 'CSS Custom Properties',
    transform: (input) => [
      {
        path: 'tokens.css',
        content: [
          ':root {\n\t--color-bg: #fff;\n}',
          ...input.variants.map(
            (v) => `[data-theme="${v.context}"] {\n\t--color-bg: #111;\n}`,
          ),
        ].join('\n'),
      },
    ],
  });
  const resolvers = new Map([['Default', resolver]]);
  const document = {
    getResolvers: () => resolvers,
    getAllTokens: () => tokens,
    subscribe: () => () => {},
  };
  return {
    document,
    services: { get: (k: string) => (k === 'exporter' ? registry : undefined) },
  } as unknown as ExtensionContext;
}

test('lists the CSS format and previews a resolver-driven file (async)', async () => {
  const { container } = render(
    <ExportRoute context={fakeContext()} config={fakeConfig([])} />,
  );
  expect(
    screen.getByRole('option', { name: 'CSS Custom Properties' }),
  ).toBeTruthy();
  await waitFor(() => {
    const preview =
      container.querySelector('.vtk-export-preview')?.textContent ?? '';
    expect(preview).toContain(':root {');
    expect(preview).toContain('[data-theme="dark"]');
    expect(preview).toContain('--color-bg: #111;');
  });
});

test('Write writes each emitted file under the output dir', async () => {
  render(<ExportRoute context={fakeContext()} config={fakeConfig([])} />);
  await waitFor(() =>
    expect(screen.getAllByText(/build\/tokens\.css/).length).toBeGreaterThan(0),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Write' }));
  await waitFor(() =>
    expect(vi.mocked(writeOutputFile)).toHaveBeenCalledWith(
      'build/tokens.css',
      expect.stringContaining(':root'),
    ),
  );
});

test('configured targets render with a run action that writes through runTargets', async () => {
  const targets: Target[] = [
    { id: 'web', exporter: 'css', composition: 'Default', out: 'build/css' },
  ];
  render(<ExportRoute context={fakeContext()} config={fakeConfig(targets)} />);

  const run = await screen.findByRole('button', { name: /run web/i });
  fireEvent.click(run);
  await waitFor(() =>
    expect(vi.mocked(writeOutputFile)).toHaveBeenCalledWith(
      'build/css/tokens.css',
      expect.stringContaining(':root'),
    ),
  );
});
