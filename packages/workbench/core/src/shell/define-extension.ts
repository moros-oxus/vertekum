import type {
  ExtensionManifest,
  ExtensionSettings,
  ExtensionSettingsInput,
} from '../config/manifest';
import type { Extension } from './types';

/** An extension paired with the tier-2 setting overrides declared inline where it is listed. */
export interface ConfiguredExtension<
  M extends ExtensionManifest = ExtensionManifest,
> {
  extension: Extension<M>;
  overrides: Partial<ExtensionSettings<M>>;
}

/**
 * The callable form of an extension (Vite-plugin style): invoke it with overrides to configure it
 * inline. It also carries `manifest`/`activate`, so an *uncalled* configurable extension is still a
 * plain `Extension` — usable directly in `defaultConfig`, `kernel.register`, etc.
 */
export interface ConfigurableExtension<
  M extends ExtensionManifest = ExtensionManifest,
> extends Extension<M> {
  (overrides?: Partial<ExtensionSettingsInput<M>>): ConfiguredExtension<M>;
}

/**
 * Wrap an extension definition so it can be configured inline (`ext({ … })`). The overrides are
 * captured as declared config — the host feeds them to tier-2 (`setHostOverrides`); `activate` keeps
 * reading them through `ctx.config`. This is authoring sugar over the config engine, NOT closure
 * state, so tier-3 user overrides + the Settings UI keep working.
 */
export function defineExtension<M extends ExtensionManifest>(
  def: Extension<M>,
): ConfigurableExtension<M> {
  const configure = (
    overrides: Partial<ExtensionSettings<M>> = {},
  ): ConfiguredExtension<M> => ({ extension: def, overrides });
  return Object.assign(configure, {
    manifest: def.manifest,
    activate: def.activate,
  });
}
