import { expect, test, vi } from 'vitest';
import { z } from 'zod';
import { createKernel } from './kernel';
import type { Extension } from './shell/types';

test('start() activates each registered extension once', () => {
  const kernel = createKernel();
  const activate = vi.fn();
  const ext: Extension = { manifest: { id: 'a', name: 'A' }, activate };
  kernel.register(ext);
  kernel.start();
  kernel.start(); // idempotent
  expect(activate).toHaveBeenCalledTimes(1);
});

test('activate receives config scoped to the extension, with schema defaults', () => {
  const kernel = createKernel();
  const settings = z.object({
    density: z.enum(['comfortable', 'compact']).default('comfortable'),
  });
  let seen: unknown;
  const ext: Extension<{
    id: 'vtk.tokens';
    name: 'Tokens';
    settings: typeof settings;
  }> = {
    manifest: { id: 'vtk.tokens', name: 'Tokens', settings },
    activate: (ctx) => {
      seen = ctx.config.get();
    },
  };
  kernel.register(ext);
  kernel.start();
  expect(seen).toEqual({ density: 'comfortable' });
});

test('host overrides set before start are visible to activate', () => {
  const kernel = createKernel();
  const settings = z.object({
    density: z.enum(['comfortable', 'compact']).default('comfortable'),
  });
  let seen: unknown;
  kernel.register({
    manifest: { id: 'vtk.tokens', name: 'Tokens', settings },
    activate: (ctx) => {
      seen = ctx.config.get();
    },
  });
  kernel.config.setHostOverrides('vtk.tokens', { density: 'compact' });
  kernel.start();
  expect(seen).toEqual({ density: 'compact' });
});

test('getExtensions records host-defined kinds and services under the contributing extension', () => {
  const kernel = createKernel();
  kernel.register({
    manifest: { id: 'vtk.x', name: 'X' },
    activate: (ctx) => {
      // 'routes' is not a kind core knows about — a UI host records it through `contribute`,
      // which is how provenance survives core no longer owning a route registry.
      ctx.contribute('routes', {
        path: '/x',
        ribbon: { label: 'X', icon: '✳' },
      });
      ctx.services.register('svc.x', {});
    },
  });
  kernel.start();

  const x = kernel.getExtensions().find((e) => e.manifest.id === 'vtk.x');
  expect(x?.active).toBe(true);
  expect(x?.contributions.routes).toEqual([
    { path: '/x', ribbon: { label: 'X', icon: '✳' } },
  ]);
  expect(x?.contributions.services).toEqual(['svc.x']);
});

test('contributions are attributed to the right extension', () => {
  const kernel = createKernel();
  kernel.register({
    manifest: { id: 'a', name: 'A' },
    activate: (ctx) => ctx.contribute('routes', { path: '/a' }),
  });
  kernel.register({
    manifest: { id: 'b', name: 'B' },
    activate: (ctx) => ctx.services.register('svc.b', {}),
  });
  kernel.start();

  const a = kernel.getExtensions().find((e) => e.manifest.id === 'a');
  const b = kernel.getExtensions().find((e) => e.manifest.id === 'b');
  expect(a?.contributions.routes).toEqual([{ path: '/a' }]);
  expect(a?.contributions.services).toEqual([]);
  expect(b?.contributions.services).toEqual(['svc.b']);
  // B contributed no routes at all, so the kind never appears — absent, not empty.
  expect(b?.contributions.routes).toBeUndefined();
});

test('getExtensions reports inactive before start', () => {
  const kernel = createKernel();
  kernel.register({ manifest: { id: 'a', name: 'A' }, activate: () => {} });
  const [only] = kernel.getExtensions();
  expect(only?.active).toBe(false);
});

test('a contributed command is recorded under its extension', () => {
  const kernel = createKernel();
  kernel.register({
    manifest: { id: 'vtk.demo', name: 'Demo' },
    activate(ctx) {
      ctx.commands.register({
        name: 'demo run',
        description: 'x',
        run: () => {},
      });
    },
  });
  kernel.start();
  const installed = kernel
    .getExtensions()
    .find((e) => e.manifest.id === 'vtk.demo');
  // Attribution is the point: core's built-in verbs share this registry, and crediting them to
  // whichever extension activated first would make `describe` lie about who contributed what.
  expect(installed?.contributions.commands).toEqual(['demo run']);

  const names = kernel.commands.list().map((c) => c.name);
  expect(names).toContain('demo run');
  expect(names).toContain('token rename');
});

test('the kernel seeds core’s curation verbs before any extension activates', () => {
  const names = createKernel()
    .commands.list()
    .map((c) => c.name);
  // Available with no extensions registered at all — they are core's, not a contribution.
  expect(names).toEqual([
    'token add',
    'token remove',
    'token set',
    'token move',
    'token rename',
    'group add',
    'group set',
    'group remove',
    'set add',
    'set remove',
    'resolver add',
    'resolver remove',
    'resolver push',
    'resolver pop',
    'resolver order',
    'resolver default',
    'resolver list',
  ]);
});
