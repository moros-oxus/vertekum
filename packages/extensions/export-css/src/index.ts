import { defineExtension, type ExtensionManifest } from '@vertekum/core';
import { activate } from './api';

export { CssOptions, cssExporter } from './css';

export const cssExportManifest = {
  id: 'vtk.export.css',
  name: 'CSS Export',
  description:
    "Adds the 'css' exporter, which writes a resolved composition as CSS custom properties — the base selection in `:root` and each modifier context under its own selector. A non-view extension: no route, no ribbon entry.",
  activation: ['onStartup'],
} satisfies ExtensionManifest;

/**
 * First-party NON-VIEW HostExtension: contributes an exporter and nothing else. One format among
 * peers — a consumer names the formats it wants rather than inheriting them.
 */
export const cssExportExtension = defineExtension<typeof cssExportManifest>({
  manifest: cssExportManifest,
  activate,
});
