import { defineExtension, type ExtensionManifest } from '@vertekum/core';
import { z } from 'zod';
import { activate } from './api';

/**
 * The input/output pair, declared once in config:
 *
 *   schemaBuilderExtension({ source: './src/dfn', out: './src/schemas' })
 *
 * `source` is where the `.dfn` modules live — the default sweep for `schema build`, `lint`,
 * and `fmt`. `out` is where built `.json` files land, mirroring `source`'s directory
 * structure; unset means beside each module. Both resolve relative to the working directory.
 */
export const SchemaBuilderSettings = z.object({
  source: z.string().default('./schemas'),
  out: z.string().optional(),
});

export const schemaBuilderManifest = {
  id: 'vtk.schema-builder',
  name: 'Schema Builder',
  description:
    "Builds `.dfn` vocabulary modules — a grammar for declaring which token names may exist, and in what order — into the JSON Schema files the `schemas` config binds. Contributes the 'schema build', 'schema lint', and 'schema fmt' commands. A non-view extension: no route, no ribbon entry.",
  settings: SchemaBuilderSettings,
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
