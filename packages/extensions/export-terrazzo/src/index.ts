import { defineExtension, type ExtensionManifest } from '@vertekum/core';
import { activate } from './api';

export { TerrazzoOptions, terrazzoExporter } from './terrazzo';
export { correctKnownLimitations } from './to-terrazzo';

export const terrazzoManifest = {
  id: 'vtk.export.terrazzo',
  name: 'Terrazzo Export',
  description:
    "Adds the 'terrazzo' exporter, which formats a resolved composition through the terrazzo plugin toolchain (CSS, JS/TS, Tailwind, native). Configure it as an export target with terrazzo plugin instances in `options.plugins`. A non-view extension: no route, no ribbon entry.",
  activation: ['onStartup'],
} satisfies ExtensionManifest;

/**
 * First-party NON-VIEW HostExtension: contributes an exporter and nothing else. Opt-in — it is not
 * part of `@vertekum/ext-essentials`, because terrazzo and its plugins are a dependency a consumer
 * should choose rather than inherit.
 */
export const terrazzoExportExtension = defineExtension<typeof terrazzoManifest>(
  {
    manifest: terrazzoManifest,
    activate,
  },
);
