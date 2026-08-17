import type { ConfigStore, InstalledExtension } from '@vertekum/core';
import { reactMount } from '../react-mount';
import type { Route } from '../shell/ui-contribution';
import { ExtensionsSurface } from './ExtensionsSurface';

/**
 * Builds the privileged /extensions route — the Extensions & Settings area. Cross-cutting
 * like the old /settings route: it enumerates ALL extensions and edits their settings, so the
 * shell registers it in main.tsx with the installed list, the config store, and persist.
 */
export function createExtensionsRoute(opts: {
  extensions: InstalledExtension[];
  config: ConfigStore;
  persist: () => void;
}): Route {
  return {
    path: '/extensions',
    ribbon: { label: 'Extensions', icon: '🧩' },
    mount: reactMount((context) => (
      <ExtensionsSurface
        extensions={opts.extensions}
        store={opts.config}
        persist={opts.persist}
        context={context}
      />
    )),
  };
}
