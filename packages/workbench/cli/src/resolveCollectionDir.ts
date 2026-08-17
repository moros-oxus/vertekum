import { dirname, isAbsolute, resolve } from 'node:path';

/**
 * The token collection dir for the bridge: the config's `collection` resolved relative to the
 * config file, else `<cwd>/tokens`.
 */
export function resolveCollectionDir(
  config: { collection?: string } | undefined,
  configPath: string | undefined,
  cwd: string,
): string {
  const collection = config?.collection;
  if (!collection) return resolve(cwd, 'tokens');
  if (isAbsolute(collection)) return collection;
  const base = configPath ? dirname(configPath) : cwd;
  return resolve(base, collection);
}
