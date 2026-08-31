import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createKernel,
  type Document,
  defaultBindings,
  dtcg,
  type Kernel,
  mergeVertekumConfig,
  normalizeExtensions,
  resolveVertekumConfig,
  type Target,
} from '@vertekum/core';
import {
  type LoadedSchemas,
  loadSchemas,
  readCollection,
} from '@vertekum/core/node';
import { loadDefaultConfig } from './defaultConfig';
import { findConfig } from './findConfig';
import { findRepoRoot } from './findRepoRoot';
import { resolveCollectionDir } from './resolveCollectionDir';

/** A booted project: resolved paths, the activated kernel, and the loaded token collection. */
export interface Project {
  configPath: string | undefined;
  projectDir: string;
  collectionDir: string;
  kernel: Kernel;
  /**
   * The hydrated document — the single source of token state. Snapshots are deliberately NOT held
   * here: a contributed command mutates the document, and a snapshot taken at load would be stale
   * for everything downstream of it.
   */
  document: Document;
  settings: Record<string, Record<string, unknown>>;
  /**
   * The schemas this project is held to, already resolved from files — bindings, the schemas their
   * `$ref`s reached, and any problem found while loading them.
   */
  schemas: LoadedSchemas;
  /** JSON indentation for writes, from the consumer's config. */
  indent: string | number | undefined;
  /** The colour space verbs and `migrate values` write; validated against the spec's set. */
  valueOptions: { colorSpace: string };
  /** Root-config export targets (ADR-0018); `vtk.export` settings remain a fallback in `readTargets`. */
  targets?: Target[];
}

/**
 * Boot a project headlessly (ADR-0030): find and evaluate the config with `command: 'build'`,
 * activate the extension graph in Node, and load the token collection from disk. No Vite, no
 * server, no UI surface — route `mount` thunks are registered but never called, so no `ui` module
 * is ever evaluated (ADR-0029).
 */
export async function loadProject(cwd: string): Promise<Project> {
  // A relative cwd (`--cwd packages/tokens`) would make every discovered path relative — and a
  // relative path handed to `import()` parses as a PACKAGE name (ERR_INVALID_MODULE_SPECIFIER).
  // Absolutize once here, and import by file URL, which is also what Windows paths require.
  const root = resolve(cwd);
  const configPath = findConfig(root);
  const userConfig = configPath
    ? resolveVertekumConfig(
        (await import(pathToFileURL(configPath).href)).default,
        { command: 'build', mode: 'production' },
      )
    : {};
  const config = mergeVertekumConfig(await loadDefaultConfig(), userConfig);

  // Metadata + generated artifacts live at the working dir: the config's dir when found, else the
  // inferred repo root — the same rule `vertekum dev` applies.
  const projectDir = configPath ? dirname(configPath) : findRepoRoot(root);
  const collectionDir = resolveCollectionDir(config, configPath, projectDir);

  const colorSpace = config.defaultColorSpace ?? 'oklch';
  if (!dtcg.values.COLOR_SPACES.includes(colorSpace)) {
    throw new Error(
      `defaultColorSpace '${colorSpace}' is not a spec colour space — one of: ${dtcg.values.COLOR_SPACES.join(', ')}`,
    );
  }

  // Schemas are config, so they resolve against the config file's directory — the same working dir
  // everything else in a project is relative to. The DTCG bindings come along as builtins, which a
  // configured entry may replace by carrying their id.
  const schemas = await loadSchemas(config.schemas ?? [], {
    dir: projectDir,
    builtins: defaultBindings(),
  });

  const kernel = createKernel();
  const { extensions, settings } = normalizeExtensions(
    config.extensions ?? [],
    config.settings,
  );
  for (const extension of extensions) kernel.register(extension);
  for (const [id, overrides] of Object.entries(settings)) {
    kernel.config.setHostOverrides(id, overrides);
  }
  kernel.start();

  // The document holds parsed files, so the collection goes straight in — there is no provider
  // round trip to make, and nothing to translate.
  kernel.document.hydrate(await readCollection(collectionDir));

  return {
    configPath,
    projectDir,
    collectionDir,
    kernel,
    document: kernel.document,
    settings,
    schemas,
    indent: config.format?.indent,
    valueOptions: { colorSpace },
    ...(config.targets ? { targets: config.targets } : {}),
  };
}
