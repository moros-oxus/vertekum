import type { RibbonEntry, Route, RouteRegistry } from './ui-contribution';

export function createRouteRegistry(): RouteRegistry {
  const routes: Route[] = [];

  return {
    register(route) {
      routes.push(route);
    },
    getRoutes() {
      return [...routes];
    },
    getRibbonEntries() {
      return routes
        .filter(
          (r): r is Route & { ribbon: RibbonEntry } => r.ribbon !== undefined,
        )
        .map((r) => ({
          path: r.path,
          label: r.ribbon.label,
          icon: r.ribbon.icon,
        }));
    },
  };
}
