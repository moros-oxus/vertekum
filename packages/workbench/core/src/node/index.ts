/**
 * Core's Node-only surface, reached as `@vertekum/core/node`.
 *
 * It is a separate subpath rather than part of the main entry because core is bundled into the
 * browser app: a `node:fs` import anywhere in `src/index.ts`'s graph breaks that build. Reading and
 * writing a collection is still the system's job — it is just a job only one environment can do.
 */
export type { JsonIndent } from './collection';
export {
  DEFAULT_INDENT,
  readCollection,
  readTextFile,
  writeCollection,
  writeTextFile,
} from './collection';
export type { LoadedSchemas } from './load-schemas';
export { loadSchemas } from './load-schemas';
export { saveDocument } from './save';
