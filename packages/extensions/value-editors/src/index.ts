import { defineExtension, type ExtensionManifest } from 'vertekum/core';
import { z } from 'zod';
import { activate } from './api';

// Public surface consumers (e.g. @vertekum/ext-tokens) depend on: the reference helpers and the
// value-editor service contract. The React parts (editors + ValueField) live at the `./ui`
// subpath so importing this module never pulls React (ADR-0029).
export { pathToReference } from './references';
export type {
  ValueEditor,
  ValueEditorLoader,
  ValueEditorProps,
  ValueEditorRegistration,
  ValueEditorService,
} from './value-editor';
export { VALUE_EDITOR_SERVICE } from './value-editor';

/** Per-$type editor preference: `{ [type]: editorId }`, overriding the first-registered default. */
export const ValueEditorSettings = z.object({
  preferred: z.record(z.string(), z.string()).default({}),
});

export const valueEditorsManifest = {
  id: 'vtk.value-editors',
  name: 'Value Editors',
  description:
    'Registers per-$type value editors (color, dimension, number, fontWeight, boolean) and publishes them for token-editing views. A non-view extension: no route or ribbon. Use `preferred` to pick an editor per type when more than one is installed.',
  settings: ValueEditorSettings,
  activation: ['onStartup'],
} satisfies ExtensionManifest;

/**
 * First-party NON-VIEW HostExtension: publishes VALUE_EDITOR_SERVICE (ADR-0028) and
 * contributes no route/ribbon. Must activate before any plugin that registers editors into
 * the shared service, so it is listed early in vertekum.config.ts.
 */
export const valueEditorsExtension = defineExtension<
  typeof valueEditorsManifest
>({
  manifest: valueEditorsManifest,
  activate,
});
