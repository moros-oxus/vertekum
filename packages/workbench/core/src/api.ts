import { emptyResolver } from './document/resolver-types';
import { exportPath } from './dtcg/parse';
import { isPointerObject, parsePointer } from './dtcg/pointer';
import {
  flatten,
  indexByPath,
  isReference,
  referenceToPath,
  resolveValue,
} from './dtcg/references';
import { resolveOrder, resolveValues, validateResolver } from './dtcg/resolve';
import { parseResolver, serializeResolver } from './dtcg/resolver';
import {
  COLOR_SPACES,
  convertColor,
  parseValueInput,
  renderCssValue,
  renderHex,
} from './dtcg/values';

/**
 * The Vertekum core DTCG API — one discoverable surface for direct token/resolver work, for every
 * consumer (exporters, extensions, UI). Domain roots keep dependency profiles honest: `dtcg` is pure
 * (no React); `ui`/`release`/etc. arrive as sibling roots later. Types stay flat type-exports; React
 * hooks and document commands are NOT part of `dtcg` — it's the pure DTCG operation library.
 */
export const dtcg = {
  /** Token/value operations (aliases, indexing, dereference). */
  tokens: {
    isReference,
    referenceToPath,
    indexByPath,
    resolveValue,
    flatten,
    exportPath,
    isPointerObject,
    parsePointer,
  },
  /** Value-notation codecs: short form in, spec form stored, CSS out. */
  values: {
    parse: parseValueInput,
    render: renderCssValue,
    renderHex,
    convertColor,
    COLOR_SPACES,
  },
  /** Resolver operations (structure, validation, value resolution, codec). */
  resolvers: {
    resolveOrder,
    validateResolver,
    resolveValues,
    // Codec — surfaced for discoverability; flat exports retained during the transition.
    parseResolver,
    serializeResolver,
    emptyResolver,
  },
};
