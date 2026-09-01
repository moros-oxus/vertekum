import type { Target } from '../export/target';
import type {
  ConfigurableExtension,
  ConfiguredExtension,
} from '../shell/define-extension';
import type { Extension } from '../shell/types';
import type { StorageProvider } from '../storage/provider';

/**
 * One entry in a config's `extensions` array: a plain (or uncalled configurable) extension, an
 * inline-configured one (`ext({ … })`), or a (nested) array of these — a bundle preset that expands
 * to several. {@link normalizeExtensions} flattens and splits these back into the id-keyed shape the
 * kernel consumes.
 */
export type ExtensionEntry =
  | Extension
  | ConfigurableExtension
  | ConfiguredExtension
  | ExtensionEntry[];

/** What one schema in a group applies to: glob(s), or the glob(s) plus overrides. */
export type SchemaUse =
  | string
  | {
      match: string | string[];
      target?: 'tokens' | 'resolver';
      severity?: 'error' | 'warning';
      domain?: string;
      /** Replaces a built-in binding of the same id instead of layering beside it. */
      id?: string;
    };

/**
 * A group of schemas from one base, and what each applies to.
 *
 * `from` is a package specifier (`@vertekum/schema-atlassian`) or a directory relative to this
 * config file (`./schemas`) — one shape, so a local schema is configured exactly like a packaged
 * one.
 *
 * Grouping exists because a design system is adopted by ASPECT: taking colour and spacing from one
 * package while leaving its typography alone is the normal case, not the exotic one, and repeating
 * the specifier on every line buries the part that differs.
 */
export interface SchemaGroup {
  from: string;
  use: Record<string, SchemaUse>;
  /** Group-level defaults; a `use` entry overrides them. */
  target?: 'tokens' | 'resolver';
  severity?: 'error' | 'warning';
  domain?: string;
}

/**
 * Host configuration (design spec 2026-07-03): the app-level tier that decides WHICH extensions
 * load and supplies tier-2 setting overrides. Code + data (it imports extension modules), the
 * analog of vite.config.ts. Replaces the hardcoded registration list in main.tsx.
 */
export interface VertekumConfig {
  /**
   * Extensions the host loads — each optionally configured inline (`ext({ … })`) or expanded from a
   * bundle array. Optional: when omitted, the system supplies `defaultConfig`'s set via
   * {@link mergeVertekumConfig} (so a repo config need only carry its overrides).
   */
  extensions?: ExtensionEntry[];
  /** Tier-2 overrides, keyed by extension id → partial settings. */
  settings?: Record<string, Record<string, unknown>>;
  /** Token collection dir (relative to this config file). Read by the CLI; ignored by the browser. */
  collection?: string;
  /**
   * The schemas this project is held to. Read by the CLI; the browser does not validate today.
   *
   * DTCG well-formedness applies whether or not this is present — it comes bundled with core. An
   * entry may REPLACE a built-in by carrying its `id`.
   */
  schemas?: SchemaGroup[];
  /**
   * The colour space verbs and `migrate values` WRITE (the 2025.10 spec's set; default 'oklch').
   * Delivery is a different choice: an export target picks its own space/format in its options.
   */
  defaultColorSpace?: string;
  /**
   * The configured export runs (ADR-0018): which exporter, over which composition, writing where,
   * with what tool options. A RUNNER concern, so it lives at config root — an exporter extension
   * contributes the capability; targets are its invocations. (`vtk.export`'s `targets` setting
   * remains readable as a fallback.)
   */
  targets?: Target[];
  /**
   * The storage/transport backend (the "substrate adapter"): a factory returning a StorageProvider.
   * Defaults to the local bridge; override for a different backend (git/hosted later). Unlike
   * extension settings, these are construction-time options closed over in the factory — not
   * tier-2 live settings. Browser-side only; ignored by the CLI.
   */
  storage?: () => StorageProvider;
  /**
   * How Vertekum formats the JSON it writes. Set this to whatever the repo's formatter produces —
   * a tool's output should not fight the formatter the repo already runs.
   *
   * `indent` is a number of spaces, or a string used verbatim (`'\t'`). Defaults to 2.
   */
  format?: { indent?: string | number };
}

/** The env passed to a function-form config (mirrors Vite's ConfigEnv). */
export interface VertekumConfigEnv {
  command: 'serve' | 'build';
  mode: string;
}

/** A config value: a static object, or a function of the env (for conditional config). */
export type VertekumConfigInput =
  | VertekumConfig
  | ((env: VertekumConfigEnv) => VertekumConfig);

/** Identity helper for authoring host config; accepts an object or a conditional function. */
export function defineConfig<T extends VertekumConfigInput>(config: T): T {
  return config;
}

/** Resolve a config input to a concrete config, invoking the function form with `env`. */
export function resolveVertekumConfig(
  input: VertekumConfigInput,
  env: VertekumConfigEnv,
): VertekumConfig {
  return typeof input === 'function' ? input(env) : input;
}

/**
 * Compose a repo's config over a base (the app's `defaultConfig`): the system owns the merge, so a
 * repo config need only carry what it changes. `extensions`/`collection` override-or-inherit;
 * `settings` merge two levels deep (per extension id, then per setting key). Kept import-free (no
 * `defaultConfig` import) to avoid the `vertekum.config.ts ↔ defineConfig.ts` cycle — the caller
 * (`main.tsx`) passes the base in.
 */
export function mergeVertekumConfig(
  base: VertekumConfig,
  override: VertekumConfig,
): VertekumConfig {
  const ids = new Set([
    ...Object.keys(base.settings ?? {}),
    ...Object.keys(override.settings ?? {}),
  ]);
  const settings: Record<string, Record<string, unknown>> = {};
  for (const id of ids) {
    settings[id] = { ...base.settings?.[id], ...override.settings?.[id] };
  }
  return {
    extensions: override.extensions ?? base.extensions,
    collection: override.collection ?? base.collection,
    // Override-or-inherit, like `extensions`: a repo declaring any schema declares ALL of them.
    // Concatenating instead would make a system default impossible to remove.
    schemas: override.schemas ?? base.schemas,
    defaultColorSpace: override.defaultColorSpace ?? base.defaultColorSpace,
    targets: override.targets ?? base.targets,
    storage: override.storage ?? base.storage,
    format: override.format ?? base.format,
    ...(ids.size > 0 ? { settings } : {}),
  };
}

/**
 * Flatten an `extensions` array (bundles, inline-configured, uncalled) into the id-keyed shape the
 * kernel consumes: `{ extensions, settings }`. Inline overrides become tier-2 host settings.
 * Last-wins with no per-key merge — a later duplicate id replaces an earlier one wholesale (no
 * plugin ordering yet); the top-level `settings` map is applied last and wins per id.
 */
export function normalizeExtensions(
  input: ExtensionEntry[],
  overrideSettings?: Record<string, Record<string, unknown>>,
): {
  extensions: Extension[];
  settings: Record<string, Record<string, unknown>>;
} {
  const extensions: Extension[] = [];
  const settings: Record<string, Record<string, unknown>> = {};

  const visit = (entry: ExtensionEntry): void => {
    if (Array.isArray(entry)) {
      for (const child of entry) visit(child);
      return;
    }
    // An uncalled configurable extension is a function; calling it yields empty overrides.
    const configured: Extension | ConfiguredExtension =
      typeof entry === 'function' ? entry() : entry;
    const extension =
      'extension' in configured ? configured.extension : configured;
    const overrides = 'extension' in configured ? configured.overrides : {};
    extensions.push(extension);
    if (Object.keys(overrides).length > 0) {
      settings[extension.manifest.id] = { ...overrides };
    }
  };

  for (const entry of input) visit(entry);
  for (const [id, o] of Object.entries(overrideSettings ?? {})) {
    settings[id] = { ...o };
  }
  return { extensions, settings };
}
