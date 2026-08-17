import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const VIRTUAL_ID = 'virtual:vertekum-config';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

/**
 * Resolves `virtual:vertekum-config` to a config module: the file named by VERTEKUM_CONFIG
 * (set by the CLI for a consumer project), else the in-repo default `src/vertekum.config.ts`
 * so `pnpm --filter vertekum dev` still works standalone.
 */
export function vertekumConfigPlugin(): Plugin {
  return {
    name: 'vertekum-config',
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
      return undefined;
    },
    load(id) {
      if (id !== RESOLVED_ID) return undefined;
      const defaultConfig = fileURLToPath(
        new URL('../vertekum.config.ts', import.meta.url),
      );
      const configPath = process.env.VERTEKUM_CONFIG ?? defaultConfig;
      return `export { default } from ${JSON.stringify(configPath)};`;
    },
  };
}
