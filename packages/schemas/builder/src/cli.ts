import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative } from 'node:path';
import type { CommandDescriptor, CommandResult } from '@vertekum/core';
import { assertOpenSetsAreNameSets, build } from './build';
import { emit, isStamped } from './emit';
import { fixSource, formatSource, resolveIndent } from './format';
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
  /** The consumer's `format.indent`, when set — fmt honors it (JSON writes already do). */
  indent?: string | number;
  /** The kernel's config store — where this extension's own settings slice lives. */
  kernel?: { config: { get<T>(id: string): T } };
}

/** The extension's configured input/output pair, defaults included. */
function settingsOf(ctx: { project: unknown }): {
  source: string;
  out?: string;
} {
  const kernel = (ctx.project as ProjectDir).kernel;
  const slice = kernel?.config.get<{ source?: string; out?: string }>(
    'vtk.schema-builder',
  );
  return { source: slice?.source ?? './schemas', out: slice?.out };
}

function modulesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.dfn') && !f.includes('node_modules'))
    .map((f) => join(dir, f));
}

/**
 * What a command's `[module]` argument means: nothing → the default sweep (`./schemas`);
 * a directory → sweep it; a file → that module alone (`explicitFile` — build's rootless
 * error applies only there). A path that exists as neither is an error up front.
 */
function resolveModules(
  projectDir: string,
  arg: string | undefined,
  sourceDefault: string,
): { modules: string[]; explicitFile: boolean; root: string } {
  if (!arg) {
    const root = join(projectDir, sourceDefault);
    return { modules: modulesUnder(root), explicitFile: false, root };
  }
  const target = join(projectDir, arg);
  if (!existsSync(target)) {
    throw new Error(`no such file or directory: ${arg}`);
  }
  if (statSync(target).isDirectory()) {
    return { modules: modulesUnder(target), explicitFile: false, root: target };
  }
  return { modules: [target], explicitFile: true, root: dirname(target) };
}

export function buildModule(
  modulePath: string,
  /** The module name the provenance stamp records; default: the basename. Pass a relative
   *  path when modules nest, so same-named modules stamp distinguishably. */
  moduleLabel?: string,
  /** Where the artifact lands; default: beside the module. */
  targetDir?: string,
): {
  target: string;
  content: string;
} {
  const resolved = resolveModule(modulePath);
  assertOpenSetsAreNameSets(resolved);
  const tree = build(resolved);
  const moduleFile = moduleLabel ?? basename(modulePath);
  return {
    target: join(targetDir ?? dirname(modulePath), `${resolved.name}.json`),
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
      description:
        "a .dfn file or directory; default: every module under './schemas'",
    },
  ],
  options: [
    {
      flag: '--fix',
      description: "apply mechanical repairs (a misplaced '*') before linting",
    },
  ],
  run(ctx): CommandResult {
    const { projectDir } = ctx.project as ProjectDir;
    const { modules } = resolveModules(
      projectDir,
      ctx.args.module,
      settingsOf(ctx).source,
    );
    if (modules.length === 0) {
      return { summary: 'no .dfn modules found' };
    }

    const project = (file: string) =>
      isAbsolute(file) ? relative(projectDir, file) : file;

    // --fix first: repaired content is linted IN MEMORY (the runner owns writing), so the
    // remaining diagnostics describe the state the fix would leave on disk.
    const files: Array<{ path: string; content: string }> = [];
    const fixed: string[] = [];
    const sources = new Map<string, string>();
    if (ctx.options.fix === true) {
      for (const modulePath of modules) {
        if (!existsSync(modulePath)) continue;
        const source = readFileSync(modulePath, 'utf8');
        const result = fixSource(source);
        if (result.fixes.length === 0) continue;
        sources.set(modulePath, result.content);
        files.push({ path: project(modulePath), content: result.content });
        for (const fix of result.fixes) {
          fixed.push(
            `${project(modulePath)}:${fix.line}:${fix.column} ${fix.message}`,
          );
        }
      }
    }

    const diagnostics = modules.flatMap((modulePath) =>
      lintModule(modulePath, sources).map((d) => ({
        ...d,
        file: project(d.file),
      })),
    );

    if (diagnostics.length > 0) {
      throw new Error(
        [
          ...(fixed.length > 0
            ? [`fixed ${fixed.length}:`, ...fixed.map((f) => `  ${f}`)]
            : []),
          `${diagnostics.length} problem(s) in the .dfn modules:`,
          ...diagnostics.map(
            (d) => `  ${d.file}:${d.line}:${d.column} ${d.message}`,
          ),
        ].join('\n'),
      );
    }
    const notes = [
      ...(fixed.length > 0
        ? [`fixed ${fixed.length} problem(s):`, ...fixed.map((f) => `  ${f}`)]
        : []),
      `${modules.length} module(s) clean`,
    ];
    return {
      summary: notes.join('\n'),
      files,
      data: { modules: modules.map(project), fixed },
    };
  },
};

/**
 * `vertekum schema fmt [module]`: canonical formatting for the `.dfn` sources — block indent
 * from `format.indent`/.editorconfig, canonical spacing, hygiene. A module whose grammar cannot
 * be lexed is skipped with a notice (broken grammar is lint's report — fmt never rewrites what
 * it cannot read). `--check` verifies instead of writing: the CI gate.
 */
export const schemaFmtCommand: CommandDescriptor = {
  name: 'schema fmt',
  description: 'format .dfn vocabulary modules canonically',
  args: [
    {
      name: 'module',
      required: false,
      description:
        "a .dfn file or directory; default: every module under './schemas'",
    },
  ],
  options: [
    {
      flag: '--check',
      description: 'verify formatting; write nothing',
    },
  ],
  run(ctx): CommandResult {
    const { projectDir, indent } = ctx.project as ProjectDir;
    const { modules } = resolveModules(
      projectDir,
      ctx.args.module,
      settingsOf(ctx).source,
    );
    if (modules.length === 0) {
      return { summary: 'no .dfn modules found', files: [] };
    }

    const project = (file: string) =>
      isAbsolute(file) ? relative(projectDir, file) : file;
    const files: Array<{ path: string; content: string }> = [];
    const skipped: string[] = [];
    const unformatted: string[] = [];

    for (const modulePath of modules) {
      const source = readFileSync(modulePath, 'utf8');
      let formatted: string;
      try {
        formatted = formatSource(source, {
          indent: resolveIndent(modulePath, indent),
        });
      } catch (error) {
        skipped.push(
          `${project(modulePath)} does not lex (${error instanceof Error ? error.message : String(error)}) — run \`vertekum schema lint\``,
        );
        continue;
      }
      if (formatted === source) continue;
      if (ctx.options.check === true) {
        unformatted.push(project(modulePath));
        continue;
      }
      files.push({ path: project(modulePath), content: formatted });
    }

    if (unformatted.length > 0) {
      throw new Error(
        `unformatted .dfn modules: ${unformatted.join(', ')} — run \`vertekum schema fmt\``,
      );
    }
    const notes = [
      ctx.options.check === true
        ? `${modules.length - skipped.length} module(s) formatted`
        : files.length > 0
          ? `formatted ${files.length} module(s)`
          : `${modules.length - skipped.length} module(s) already formatted`,
      ...skipped,
    ];
    return { summary: notes.join('\n'), files, data: { skipped } };
  },
};

export const schemaBuildCommand: CommandDescriptor = {
  name: 'schema build',
  description: 'build .dfn vocabulary modules into JSON Schema files',
  args: [
    {
      name: 'module',
      required: false,
      description:
        "a .dfn file or directory; default: the configured source ('./schemas')",
    },
    {
      name: 'out',
      required: false,
      description:
        'output directory for this run; default: the configured out, else beside each module',
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
    const settings = settingsOf(ctx);
    const { modules, explicitFile, root } = resolveModules(
      projectDir,
      ctx.args.module,
      settings.source,
    );
    if (modules.length === 0) {
      return { summary: 'no .dfn modules found', files: [] };
    }

    // Where a module's artifact lands: the positional `[out]` pairs with THIS invocation's
    // module root; the configured `out` pairs with the configured `source`; a module outside
    // its pair's root builds beside itself — input and output are a pair, not a redirect.
    const outArg = ctx.args.out as string | undefined;
    const outDir = outArg
      ? join(projectDir, outArg)
      : settings.out
        ? join(projectDir, settings.out)
        : undefined;
    const pairRoot = outArg ? root : join(projectDir, settings.source);
    const targetDirFor = (modulePath: string): string | undefined => {
      if (!outDir) return undefined;
      if (outArg && explicitFile) return outDir;
      const within = relative(pairRoot, dirname(modulePath));
      if (within.startsWith('..') || isAbsolute(within)) return undefined;
      return join(outDir, within);
    };

    const files: Array<{ path: string; content: string }> = [];
    const skipped: string[] = [];
    const fragments: string[] = [];
    const stale: string[] = [];

    for (const modulePath of modules) {
      // A rootless module is a FRAGMENT — imports for other modules. The sweep skips it;
      // naming one explicitly stays an error (buildModule throws), since silence there
      // would hide a typo'd `root`.
      if (!explicitFile && !resolveModule(modulePath).module.root) {
        fragments.push(relative(projectDir, modulePath));
        continue;
      }
      const { target, content } = buildModule(
        modulePath,
        relative(projectDir, modulePath),
        targetDirFor(modulePath),
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
