import { defineExtension, type ExtensionManifest } from '@vertekum/core';
import { activate } from './api';

export type { FigmaDialect, OutputFile } from './dialect';
export { type FigmaOptions, figmaExporter } from './figma';
export {
  type BuildModelOptions,
  buildModel,
  type FigmaCollection,
  type FigmaModel,
  type FigmaStyle,
  type FigmaType,
  type FigmaVariable,
  MODEL_VERSION,
  type TypeContributor,
} from './model';

export const figmaManifest = {
  id: 'vtk.export.figma',
  name: 'Figma Export',
  description:
    "Adds the 'figma' exporter, which resolves a composition into a Figma-shaped model — collections, modes, variables, aliases, styles — emitted as a versioned artifact, plus any configured dialect writers targeting specific Figma importers. A non-view extension: no route, no ribbon entry.",
  activation: ['onStartup'],
} satisfies ExtensionManifest;

/**
 * First-party NON-VIEW HostExtension: contributes an exporter and nothing else. The model artifact
 * is the contract consumed by dialect writers here and by external tools (a Figma plugin, agents).
 */
export const figmaExportExtension = defineExtension<typeof figmaManifest>({
  manifest: figmaManifest,
  activate,
});
