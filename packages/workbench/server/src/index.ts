// The bridge server, plus the collection/file primitives the CLI shares with it so both writers
// land in the same place through the same guards (ADR-0015, ADR-0018 amendment).
export {
  readCollection,
  readTextFile,
  writeCollection,
  writeTextFile,
} from './collection-fs';
export { createBridgeServer } from './server';
