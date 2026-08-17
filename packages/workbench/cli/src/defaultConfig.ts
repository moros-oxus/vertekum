import type { VertekumConfigInput } from '@vertekum/core';

/**
 * The system-default config the headless boot merges under the consumer's. With the app
 * installed it is the app's host config (`vertekum/default-config`: the essentials extension
 * set and the bridge storage backend), keeping `check`/`build` at parity with `vertekum dev`.
 * Without the app — a consumer that installed only the headless packages — the default is
 * empty: core's builtin validators and schema bindings still run, and nothing else is implied.
 *
 * Only "the app is not installed" falls back; an app that is present but fails to load must
 * surface, not vanish into an empty default.
 */
export async function loadDefaultConfig(
  importer: (specifier: string) => Promise<{ default: VertekumConfigInput }> = (
    specifier,
  ) => import(specifier),
): Promise<VertekumConfigInput> {
  try {
    return (await importer('vertekum/default-config')).default;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (
      code === 'ERR_MODULE_NOT_FOUND' ||
      code === 'ERR_PACKAGE_PATH_NOT_EXPORTED'
    ) {
      return {};
    }
    throw error;
  }
}
