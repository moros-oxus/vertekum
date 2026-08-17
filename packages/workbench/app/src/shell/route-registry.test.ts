import { describe, expect, test } from 'vitest';
import { createRouteRegistry } from './route-registry';

const noopMount = () => {};

describe('route registry', () => {
  test('registers and lists routes in order', () => {
    const routes = createRouteRegistry();

    routes.register({ path: '/', mount: noopMount });
    routes.register({ path: '/tokens', mount: noopMount });

    expect(routes.getRoutes().map((r) => r.path)).toEqual(['/', '/tokens']);
  });

  test('ribbon entries come only from routes that declare one, in order', () => {
    const routes = createRouteRegistry();

    routes.register({
      path: '/',
      mount: noopMount,
      ribbon: { label: 'Dashboard' },
    });
    routes.register({ path: '/tokens', mount: noopMount });
    routes.register({
      path: '/settings',
      mount: noopMount,
      ribbon: { label: 'Settings', icon: '⚙' },
    });

    expect(routes.getRibbonEntries().map((e) => [e.path, e.label])).toEqual([
      ['/', 'Dashboard'],
      ['/settings', 'Settings'],
    ]);
  });
});
