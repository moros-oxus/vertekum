import { defineConfig } from 'vitest/config';

/**
 * Package-local run: `npm test` from this directory. The monorepo's root runner collects these
 * same tests through its own config; this file only makes the package self-sufficient.
 */
export default defineConfig({ test: {} });
