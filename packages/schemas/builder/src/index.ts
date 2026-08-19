import { defineExtension, type ExtensionManifest } from '@vertekum/core';
import { activate } from './api';

export const schemaBuilderManifest = {
  id: 'vtk.schema-builder',
  name: 'Schema Builder',
  description:
    "Builds `.dfn` vocabulary modules — a grammar for declaring which token names may exist, and in what order — into the JSON Schema files the `schemas` config binds. Contributes the 'schema build' command. A non-view extension: no route, no ribbon entry.",
  activation: ['onStartup'],
} satisfies ExtensionManifest;

/**
 * Grammar in, schemas out: the vocabulary is DECLARED in `.dfn` modules and BUILT into ordinary
 * schema files, which stay the only thing binding and validation ever see.
 */
export const schemaBuilderExtension = defineExtension<
  typeof schemaBuilderManifest
>({
  manifest: schemaBuilderManifest,
  activate,
});
