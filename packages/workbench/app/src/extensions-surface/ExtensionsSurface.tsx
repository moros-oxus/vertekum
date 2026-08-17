import type {
  ConfigStore,
  ExtensionContext,
  InstalledExtension,
  LocationService,
} from '@vertekum/core';
import { LOCATION_SERVICE } from '@vertekum/core';
import { useCallback, useSyncExternalStore } from 'react';
import { ExtensionSettings } from '../config/ExtensionSettings';
import type { RouteContribution } from '../shell/ui-contribution';

/**
 * Routes are a host-defined contribution kind, so the kernel records them untyped — core no longer
 * knows what a route is. The UI host defined the kind, so it is the right place to name the shape.
 */
function routesOf(ext: InstalledExtension): RouteContribution[] {
  return (ext.contributions.routes ?? []) as RouteContribution[];
}

/**
 * The VS Code-like Extensions & Settings area (ADR-0022): a list of every installed extension
 * and a detail pane showing its identity, description, provenance-recorded capabilities,
 * activation status, and settings. Selection persists in the URL (?ext=…) via the location
 * service, the same pattern the Tokens/Themes views use for the theme param.
 */
export function ExtensionsSurface({
  extensions,
  store,
  persist,
  context,
}: {
  extensions: InstalledExtension[];
  store: ConfigStore;
  persist: () => void;
  context: ExtensionContext;
}) {
  const location = context.services.get<LocationService>(LOCATION_SERVICE);
  const selectedId = useSyncExternalStore(
    useCallback(
      (cb: () => void) => location?.subscribe(cb) ?? (() => {}),
      [location],
    ),
    () => location?.getParam('ext'),
  );
  const selected =
    extensions.find((e) => e.manifest.id === selectedId) ?? extensions[0];
  const select = (id: string) => location?.setParam('ext', id);

  return (
    <vtk-extensions>
      <nav aria-label="Extensions">
        <ul>
          {extensions.map((ext) => {
            const isView = routesOf(ext).some((r) => r.ribbon);
            return (
              <li key={ext.manifest.id}>
                <button
                  type="button"
                  data-vtk-active={
                    ext.manifest.id === selected?.manifest.id ? '' : undefined
                  }
                  onClick={() => select(ext.manifest.id)}
                >
                  <span className="vtk-ext-name">{ext.manifest.name}</span>
                  {!isView && <span className="vtk-ext-badge">non-view</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <section>
        {selected ? (
          <ExtensionDetail ext={selected} store={store} persist={persist} />
        ) : (
          <p className="vtk-empty">No extensions installed.</p>
        )}
      </section>
    </vtk-extensions>
  );
}

function ExtensionDetail({
  ext,
  store,
  persist,
}: {
  ext: InstalledExtension;
  store: ConfigStore;
  persist: () => void;
}) {
  const { manifest, contributions, active } = ext;
  const routes = routesOf(ext);
  const ribbonLabels = routes
    .map((r) => r.ribbon?.label)
    .filter((label): label is string => label !== undefined);
  const dash = (parts: string[]) => (parts.length ? parts.join(', ') : '—');

  return (
    <article className="vtk-ext-detail">
      <header className="vtk-ext-header">
        <h1>{manifest.name}</h1>
        <code>{manifest.id}</code>
        <span
          className="vtk-ext-status"
          data-vtk-active={active ? '' : undefined}
        >
          {active ? 'Active' : 'Inactive'}
        </span>
      </header>

      {manifest.description && (
        <p className="vtk-ext-description">{manifest.description}</p>
      )}

      <h2>Capabilities</h2>
      <dl className="vtk-ext-capabilities">
        <dt>Routes</dt>
        <dd>{dash(routes.map((r) => r.path))}</dd>
        <dt>Ribbon</dt>
        <dd>{dash(ribbonLabels)}</dd>
        <dt>Services</dt>
        <dd>{dash(contributions.services)}</dd>
        <dt>Slots</dt>
        <dd>{dash((contributions.slots ?? []) as string[])}</dd>
        <dt>Settings</dt>
        <dd>{manifest.settings ? 'yes' : '—'}</dd>
      </dl>

      {manifest.settings && (
        <>
          <h2>Settings</h2>
          <ExtensionSettings
            manifest={manifest}
            store={store}
            persist={persist}
          />
        </>
      )}
    </article>
  );
}
