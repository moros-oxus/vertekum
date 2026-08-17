/**
 * Collection file I/O lives in `@vertekum/core/node` — reading and writing the collection is the
 * system's job, not the bridge's. The bridge is one client of it (the browser's, over HTTP); the
 * CLI is another. Re-exported here so the server's own modules and its public surface keep working.
 */
export {
  readCollection,
  readTextFile,
  writeCollection,
  writeTextFile,
} from '@vertekum/core/node';
