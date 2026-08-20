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
): ResolvedModule {
  const absolute = resolve(path);
  if (inProgress.has(absolute)) {
    throw new DfnError(`import cycle through ${basename(absolute)}`, 1, 1);
  }
  inProgress.add(absolute);

  let source: string;
  try {
    source = readFileSync(absolute, 'utf8');
  } catch {
    throw new DfnError(`cannot read ${absolute}`, 1, 1);
  }
  const module = parse(source);

  const imports = new Map<string, ResolvedModule>();
  for (const spec of module.uses) {
    const target = resolveSpecifier(spec, dirname(absolute));
    const resolved = resolveModule(target, inProgress);
    if (imports.has(resolved.name)) {
      throw new DfnError(`two imports share the name '${resolved.name}'`, 1, 1);
    }
    imports.set(resolved.name, resolved);
  }

  inProgress.delete(absolute);
  return {
    path: absolute,
    name: basename(absolute).replace(/\.dfn$/, ''),
    module,
    imports,
  };
}
