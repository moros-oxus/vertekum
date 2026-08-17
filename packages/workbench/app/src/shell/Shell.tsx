import { Link, Outlet } from '@tanstack/react-router';
import type { Kernel } from '@vertekum/core';
import { useEffect, useSyncExternalStore } from 'react';
import type { SyncManager } from '../sync';
import { SlotHost } from './SlotHost';
import type { RouteRegistry, SlotRegistry } from './ui-contribution';

/**
 * The kernel-owned app shell: persistent chrome (toolbar / ribbon / statusBar) around the
 * router outlet in `main` (ADR-0016, ADR-0022). Hosts the unified Sync action + dirty
 * indicator (ADR-0019, skeleton form: write-through, no git yet).
 */
export function Shell({
  kernel,
  routes,
  slots,
  sync,
}: {
  kernel: Kernel;
  routes: RouteRegistry;
  slots: SlotRegistry;
  sync: SyncManager;
}) {
  const tokenCount = useSyncExternalStore(
    (cb) => kernel.document.subscribe(cb),
    () => kernel.document.getAllTokens().length,
  );
  const dirty = useSyncExternalStore(
    (cb) => sync.subscribe(cb),
    () => sync.isDirty(),
  );
  const ribbon = routes.getRibbonEntries();

  // Cmd/Ctrl+S syncs.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 's') return;
      e.preventDefault();
      void sync.sync();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sync]);

  return (
    <vtk-shell>
      <vtk-toolbar>
        <span className="vtk-brand">Vertekum</span>
        <SlotHost id="toolbar" kernel={kernel} slots={slots} />
        <span className="vtk-toolbar-spacer" />
        <button
          type="button"
          className="vtk-sync"
          onClick={() => void sync.sync()}
          disabled={!dirty}
        >
          {dirty ? 'Sync' : 'Synced'}
        </button>
      </vtk-toolbar>
      <vtk-ribbon>
        <nav aria-label="Primary">
          {ribbon.map((entry) => (
            <Link
              key={entry.path}
              to={entry.path}
              title={entry.label}
              className="vtk-ribbon-item"
            >
              <span aria-hidden="true">{entry.icon ?? '•'}</span>
              <span className="sr-only">{entry.label}</span>
            </Link>
          ))}
        </nav>
      </vtk-ribbon>
      <main>
        <Outlet />
      </main>
      <vtk-statusbar>
        <SlotHost id="statusBar" kernel={kernel} slots={slots} />
        <span
          className="vtk-status-dirty"
          data-vtk-dirty={dirty ? '' : undefined}
        >
          {dirty ? '● Unsaved' : 'All changes saved'}
        </span>
        <span className="vtk-status-count">{tokenCount} tokens</span>
      </vtk-statusbar>
    </vtk-shell>
  );
}
