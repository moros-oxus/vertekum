import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join, resolve } from 'node:path';
import type { Module } from './ast';
import { DfnError } from './error';
import { parse } from './parser';

/** A parsed module plus its imports, keyed by module name (basename without `.dfn`). */
export interface ResolvedModule {
  /** Absolute path of the module file. */
  path: string;
  /** Module name: basename without extension — how `<@name>` finds an imported root. */
  name: string;
  module: Module;
  imports: Map<string, ResolvedModule>;
}

/**
 * Resolve a `use` specifier from the importing module's location. Relative specifiers walk the
 * filesystem; package specifiers (`@scope/pkg/file.dfn`) resolve the package root via its
 * `package.json` and join the rest — `require.resolve` on the file itself would demand an exports
 * entry per `.dfn`, which content packages should not need.
 */
function resolveSpecifier(spec: string, fromDir: string): string {
  if (spec.startsWith('.')) return resolve(fromDir, spec);
  const require = createRequire(join(fromDir, 'noop.js'));
  // Exports-aware first: a package may remap flat specifiers into folders
  // (`"./*.dfn": "./dfn/*.dfn"`). Root-join second, for content packages with no map.
  try {
    return require.resolve(spec);
  } catch {
    const segments = spec.split('/');
    const packageEnd = spec.startsWith('@') ? 2 : 1;
    const packageName = segments.slice(0, packageEnd).join('/');
    const rest = segments.slice(packageEnd).join('/');
    const packageJson = require.resolve(`${packageName}/package.json`);
    return join(dirname(packageJson), rest);
  }
}

/** Parse a module file and, recursively, everything it `use`s. A cycle is an authoring error. */
export function resolveModule(
  path: string,
  inProgress: Set<string> = new Set(),
  /** In-memory source overrides by absolute path — how `lint --fix` validates before writing. */
  sources?: Map<string, string>,
): ResolvedModule {
  const absolute = resolve(path);
  if (inProgress.has(absolute)) {
    throw new DfnError(`import cycle through ${basename(absolute)}`, 1, 1);
  }
  inProgress.add(absolute);

  let source: string;
  const override = sources?.get(absolute);
  if (override !== undefined) {
    source = override;
  } else {
    try {
      source = readFileSync(absolute, 'utf8');
    } catch {
      throw new DfnError(`cannot read ${absolute}`, 1, 1);
    }
  }
  let module: Module;
  try {
    module = parse(source);
  } catch (error) {
    // Stamp the file: a sweep parses many modules, and `13:10 …` without a file name is
    // exactly the kind of message this pipeline should never emit.
    if (error instanceof DfnError && !error.file) {
      throw new DfnError(error.detail, error.line, error.column, absolute);
    }
    throw error;
  }

  const imports = new Map<string, ResolvedModule>();
  for (const { spec, alias } of module.uses) {
    const target = resolveSpecifier(spec, dirname(absolute));
    const resolved = resolveModule(target, inProgress, sources);
    const key = alias ?? resolved.name;
    if (imports.has(key)) {
      throw new DfnError(
        `two imports share the name '${key}' — alias one: use "…" as other-name`,
        1,
        1,
      );
    }
    imports.set(key, resolved);
  }

  inProgress.delete(absolute);
  return {
    path: absolute,
    name: basename(absolute).replace(/\.dfn$/, ''),
    module,
    imports,
  };
}
