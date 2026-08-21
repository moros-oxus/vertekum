import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative } from 'node:path';
import type { CommandDescriptor, CommandResult } from '@vertekum/core';
import { assertOpenSetsAreNameSets, build } from './build';
import { emit, isStamped } from './emit';
import { lintModule } from './lint';
import { resolveModule } from './resolve';

/**
 * `vertekum schema build [module]` (ADR-0030): expand `.dfn` modules and DECLARE the built JSON
 * Schema files on the result — the runner owns writing, `--dry-run`, and `--json`. With no
 * module argument, every `.dfn` under the project's `schemas/` directory builds. `--check`
 * verifies the built files on disk are current instead of writing; stale files are an error
 * (exit 1), which is the CI staleness gate.
 */

/** The slice of the CLI's Project this command reads. */
interface ProjectDir {
  projectDir: string;
}

function modulesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.dfn') && !f.includes('node_modules'))
    .map((f) => join(dir, f));
}

export function buildModule(
  modulePath: string,
  /** The module name the provenance stamp records; default: the basename. Pass a relative
   *  path when modules nest, so same-named modules stamp distinguishably. */
  moduleLabel?: string,
): {
  target: string;
  content: string;
} {
  const resolved = resolveModule(modulePath);
  assertOpenSetsAreNameSets(resolved);
  const tree = build(resolved);
  const moduleFile = moduleLabel ?? basename(modulePath);
  return {
    target: join(dirname(modulePath), `${resolved.name}.json`),
    content: emit(tree, { moduleFile, ...resolved.module.meta }),
  };
}

/**
 * `vertekum schema lint [module]`: validate the `.dfn` sources themselves. Where `build --check`
 * asks "are the artifacts current?", lint asks "is the grammar sound?" — fragments included,
 * every production evaluated, findings collected instead of aborting on the first. Findings exit
 * `1` through a thrown error carrying the listing (the `build --check` staleness precedent).
 */
export const schemaLintCommand: CommandDescriptor = {
  name: 'schema lint',
  description:
    'validate .dfn vocabulary modules — fragments included — without building',
  args: [
    {
      name: 'module',
      required: false,
      description: "a .dfn file; default: every module under './schemas'",
    },
  ],
  run(ctx): CommandResult {
    const { projectDir } = ctx.project as ProjectDir;
    const modules = ctx.args.module
      ? [join(projectDir, ctx.args.module)]
      : modulesUnder(join(projectDir, 'schemas'));
    if (modules.length === 0) {
      return { summary: 'no .dfn modules found' };
    }

    const project = (file: string) =>
      isAbsolute(file) ? relative(projectDir, file) : file;
    const diagnostics = modules.flatMap((modulePath) =>
      lintModule(modulePath).map((d) => ({ ...d, file: project(d.file) })),
    );

    if (diagnostics.length > 0) {
      throw new Error(
        [
          `${diagnostics.length} problem(s) in the .dfn modules:`,
          ...diagnostics.map(
            (d) => `  ${d.file}:${d.line}:${d.column} ${d.message}`,
          ),
        ].join('\n'),
      );
    }
    return {
      summary: `${modules.length} module(s) clean`,
      data: { modules: modules.map(project) },
    };
  },
};

export const schemaBuildCommand: CommandDescriptor = {
  name: 'schema build',
  description: 'build .dfn vocabulary modules into JSON Schema files',
  args: [
    {
      name: 'module',
      required: false,
      description: "a .dfn file; default: every module under './schemas'",
    },
  ],
  options: [
    {
      flag: '--check',
      description: 'verify built files are current; write nothing',
    },
  ],
  run(ctx): CommandResult {
    const { projectDir } = ctx.project as ProjectDir;
    const modules = ctx.args.module
      ? [join(projectDir, ctx.args.module)]
      : modulesUnder(join(projectDir, 'schemas'));
    if (modules.length === 0) {
      return { summary: 'no .dfn modules found', files: [] };
    }

    const files: Array<{ path: string; content: string }> = [];
    const skipped: string[] = [];
    const fragments: string[] = [];
    const stale: string[] = [];

    for (const modulePath of modules) {
      // A rootless module is a FRAGMENT — imports for other modules. The sweep skips it;
      // naming one explicitly stays an error (buildModule throws), since silence there
      // would hide a typo'd `root`.
      if (!ctx.args.module && !resolveModule(modulePath).module.root) {
        fragments.push(relative(projectDir, modulePath));
        continue;
      }
      const { target, content } = buildModule(
        modulePath,
        relative(projectDir, modulePath),
      );
      const existing = existsSync(target)
        ? readFileSync(target, 'utf8')
        : undefined;
      const targetRelative = relative(projectDir, target);

      if (ctx.options.check === true) {
        if (existing !== content) stale.push(targetRelative);
        continue;
      }
      if (existing !== undefined && !isStamped(existing)) {
        skipped.push(targetRelative);
        continue;
      }
      files.push({ path: targetRelative, content });
    }

    if (stale.length > 0) {
      throw new Error(
        `stale built schemas: ${stale.join(', ')} — run \`vertekum schema build\``,
      );
    }
    const notes = [
      ctx.options.check === true
        ? `${modules.length - fragments.length} module(s) current`
        : `built ${files.length} module(s)`,
      ...fragments.map((f) => `${f} declares no root (a fragment) — skipped`),
      ...skipped.map((f) => `${f} has local edits (no stamp) — left as is`),
    ];
    return { summary: notes.join('\n'), files, data: { skipped, fragments } };
  },
};
