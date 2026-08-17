/**
 * The config engine lives in `@vertekum/core` — resolving and composing a consumer's config is
 * system behaviour, not presentation. This module is retained because consumers' `vertekum.config.ts`
 * files import `defineConfig` from `vertekum/config`, which is the stable public path.
 */
export type {
  ExtensionEntry,
  VertekumConfig,
  VertekumConfigEnv,
  VertekumConfigInput,
} from '@vertekum/core';
export {
  defineConfig,
  mergeVertekumConfig,
  normalizeExtensions,
  resolveVertekumConfig,
} from '@vertekum/core';
