import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative } from 'node:path';
import type { CommandDescriptor, CommandResult } from '@vertekum/core';
import {
  assertOpenSetsAreNameSets,
  build,
  evaluateProduction,
  type PatternRef,
  type TreeNode,
} from './build';
import { emit, isStamped } from './emit';
import { DfnError } from './error';
import { fixSource, formatSource, resolveIndent } from './format';
import { lintModule } from './lint';
import {
  breakTokens,
  fullPaths,
  leastPaths,
  mockTokens,
  renderNames,
  renderTokens,
  rng,
  typeResolver,
} from './mock';
import { type ResolvedModule, resolveModule } from './resolve';

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
  link: boolean;
  schemaId?: string;
  mock: { out: string; types?: Record<string, string> };
} {
  const kernel = (ctx.project as ProjectDir).kernel;
  const slice = kernel?.config.get<{
    source?: string;
    out?: string;
    link?: boolean;
    schemaId?: string;
    mock?: { out?: string; types?: Record<string, string> };
  }>('vtk.schema-builder');
  return {
    source: slice?.source ?? './schemas',
    out: slice?.out,
    link: slice?.link === true,
    schemaId: slice?.schemaId,
    mock: {
      out: slice?.mock?.out ?? './mocks',
      ...(slice?.mock?.types ? { types: slice.mock.types } : {}),
    },
  };
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

/** A module's NATURE: the `scope` pragma, defaulted by root presence. */
export function natureOf(
  resolved: ResolvedModule,
): 'document' | 'def' | 'inline' {
  return (
    resolved.module.meta.scope ?? (resolved.module.root ? 'document' : 'def')
  );
}

export interface BuildModuleOptions {
  /** The module name the provenance stamp records; default: the basename. Pass a relative
   *  path when modules nest, so same-named modules stamp distinguishably. */
  label?: string;
  /** Where the artifact lands; default: beside the module. */
  targetDir?: string;
  /** Derived `$id` for this artifact (configured base + path); the `id` pragma wins. */
  schemaId?: string;
  /** Linked emission: resolve a module to the artifact path a cross-file `$ref` should use. */
  linkResolve?: (module: ResolvedModule) => string | undefined;
}

export function buildModule(
  modulePath: string,
  options: BuildModuleOptions = {},
): {
  target: string;
  content: string;
} {
  const resolved = resolveModule(modulePath);
  assertOpenSetsAreNameSets(resolved);
  const nature = natureOf(resolved);
  if (nature === 'inline') {
    throw new DfnError(
      `${resolved.name}.dfn is scope "inline" — it is never emitted`,
      1,
      1,
      resolved.path,
    );
  }
  if (nature === 'document' && !resolved.module.root) {
    throw new DfnError(
      `scope "document" requires a root — ${resolved.name}.dfn declares none`,
      1,
      1,
      resolved.path,
    );
  }

  const tree = resolved.module.root ? build(resolved) : undefined;

  // Public patterns in declaration order, bare-evaluated; plus a memoized provider for
  // emission's deep-checks (covering cross-module patterns and def-scope roots).
  const patterns = new Map<string, TreeNode>();
  for (const name of resolved.module.productions.keys()) {
    if (resolved.module.private.has(name)) continue;
    patterns.set(name, evaluateProduction(resolved, name));
  }
  const bareMemo = new Map<string, TreeNode | undefined>();
  const bare = (ref: PatternRef): TreeNode | undefined => {
    const key = ref.module
      ? `@${ref.module.path}/${ref.root ? '/root' : ref.name}`
      : ref.name;
    if (!bareMemo.has(key)) {
      let value: TreeNode | undefined;
      if (!ref.module) value = patterns.get(ref.name);
      else if (ref.root) value = build(ref.module);
      else value = evaluateProduction(ref.module, ref.name);
      bareMemo.set(key, value);
    }
    return bareMemo.get(key);
  };

  const moduleFile = options.label ?? basename(modulePath);
  const meta = resolved.module.meta;
  return {
    target: join(
      options.targetDir ?? dirname(modulePath),
      `${resolved.name}.json`,
    ),
    content: emit(tree, {
      moduleFile,
      id: meta.id,
      schemaId: options.schemaId,
      title: meta.title,
      description: meta.description,
      scopeKind: nature,
      // A def file is pattern-natured: its body stays unsealed unless the author seals it,
      // so consumers can whole-file-compose it. A document validates alone: sealed.
      sealed: meta.sealed ?? nature === 'document',
      patterns,
      rootDefName:
        nature === 'def' && resolved.module.root ? 'root' : undefined,
      bare,
      linkResolve: options.linkResolve,
    }),
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

    const found = modules.flatMap((modulePath) =>
      lintModule(modulePath, sources).map((d) => ({
        ...d,
        file: project(d.file),
      })),
    );
    const warningLine = (d: (typeof found)[number]) =>
      `  ${d.file}:${d.line}:${d.column} warning: ${d.message}`;
    const warnings = found.filter((d) => d.severity === 'warning');
    const diagnostics = found.filter((d) => d.severity !== 'warning');

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
          ...warnings.map(warningLine),
        ].join('\n'),
      );
    }
    const notes = [
      ...(fixed.length > 0
        ? [`fixed ${fixed.length} problem(s):`, ...fixed.map((f) => `  ${f}`)]
        : []),
      ...warnings.map(warningLine),
      `${modules.length} module(s) clean${warnings.length > 0 ? `, ${warnings.length} warning(s)` : ''}`,
    ];
    return {
      summary: notes.join('\n'),
      files,
      data: { modules: modules.map(project), fixed, warnings },
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
      // A `scope "inline"` module is never emitted — the sweep skips it with a notice;
      // naming one explicitly stays an error (buildModule throws), since silence there
      // would hide the wrong pragma.
      if (!explicitFile) {
        const resolved = resolveModule(modulePath);
        const nature =
          resolved.module.meta.scope ??
          (resolved.module.root ? 'document' : 'def');
        if (nature === 'inline') {
          fragments.push(relative(projectDir, modulePath));
          continue;
        }
      }
      const parentTargetDir = targetDirFor(modulePath) ?? dirname(modulePath);
      // Linked mode: a child links only when THIS project builds it — its artifact must be
      // computable through the same source/out mapping. Package modules inline.
      const linkResolve = settings.link
        ? (child: ResolvedModule): string | undefined => {
            const within = relative(projectDir, child.path);
            if (within.startsWith('..') || within.includes('node_modules')) {
              return undefined;
            }
            const childDir = targetDirFor(child.path) ?? dirname(child.path);
            const ref = relative(
              parentTargetDir,
              join(childDir, `${child.name}.json`),
            );
            return ref.startsWith('.') ? ref : `./${ref}`;
          }
        : undefined;
      const derivedId = settings.schemaId
        ? settings.schemaId.replace(/\/?$/, '/') +
          relative(
            outDir ?? join(projectDir, settings.source),
            join(
              parentTargetDir,
              `${basename(modulePath).replace(/\.dfn$/, '')}.json`,
            ),
          )
        : undefined;
      const { target, content } = buildModule(modulePath, {
        label: relative(projectDir, modulePath),
        targetDir: targetDirFor(modulePath),
        schemaId: derivedId,
        linkResolve,
      });
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
      ...fragments.map((f) => `${f} is scope "inline" — skipped`),
      ...skipped.map((f) => `${f} has local edits (no stamp) — left as is`),
    ];
    return { summary: notes.join('\n'), files, data: { skipped, fragments } };
  },
};

/**
 * `vertekum schema mock` — make the granted matrix tangible: a names listing, a usable sample
 * token file, and (with `--break`) a deliberately broken sibling that `check` must catch.
 * Coverage `least` exercises every parent→child name adjacency once; `full` is the whole
 * matrix. Deterministic at a fixed `--seed`, so mocks are diff-stable.
 */
export const schemaMockCommand: CommandDescriptor = {
  name: 'schema mock',
  description:
    'generate the name matrix and sample token files a vocabulary grants',
  args: [
    {
      name: 'module',
      required: false,
      description:
        "a .dfn file or directory; default: the configured source ('./schemas')",
    },
  ],
  options: [
    {
      flag: '--style <style>',
      description: "'names' (markdown) or 'tokens' (DTCG sample); default both",
    },
    {
      flag: '--coverage <coverage>',
      description:
        "'least' (every name adjacency once; default) or 'full' (the whole matrix)",
    },
    {
      flag: '--break <p>',
      description:
        'probability 0..1 that each token breaks (name or value) — emitted as a separate *.broken.tokens.json',
    },
    {
      flag: '--type <type>',
      description: "fallback DTCG $type for mock tokens (default 'color')",
    },
    {
      flag: '--seed <n>',
      description: 'RNG seed for the breakage pass (default 1)',
    },
  ],
  run(ctx): CommandResult {
    const { projectDir } = ctx.project as ProjectDir;
    const settings = settingsOf(ctx);
    const style = (ctx.options.style as string | undefined) ?? 'both';
    if (!['names', 'tokens', 'both'].includes(style)) {
      throw new Error(`--style must be 'names' or 'tokens', got '${style}'`);
    }
    const coverage = (ctx.options.coverage as string | undefined) ?? 'least';
    if (!['least', 'full'].includes(coverage)) {
      throw new Error(
        `--coverage must be 'least' or 'full', got '${coverage}'`,
      );
    }
    const breakP = Number((ctx.options.break as string | undefined) ?? '0');
    if (!Number.isFinite(breakP) || breakP < 0 || breakP > 1) {
      throw new Error(`--break must be a probability 0..1`);
    }
    const seed = Number((ctx.options.seed as string | undefined) ?? '1');
    const typeOf = typeResolver(
      settings.mock.types,
      ctx.options.type as string | undefined,
    );

    const { modules, explicitFile, root } = resolveModules(
      projectDir,
      ctx.args.module,
      settings.source,
    );
    if (modules.length === 0) {
      return { summary: 'no .dfn modules found', files: [] };
    }

    const files: Array<{ path: string; content: string }> = [];
    const skipped: string[] = [];
    let names = 0;
    let tokensOut = 0;

    for (const modulePath of modules) {
      const resolved = resolveModule(modulePath);
      if (natureOf(resolved) === 'inline' || !resolved.module.root) {
        // Inline modules never emit; a rootless fragment has no matrix of its own. In a sweep
        // both are notices; an explicit fragment is worth an error.
        if (explicitFile) {
          throw new Error(
            `${relative(projectDir, modulePath)} declares no root — nothing to mock`,
          );
        }
        skipped.push(relative(projectDir, modulePath));
        continue;
      }
      const tree = build(resolved);
      const paths = coverage === 'full' ? fullPaths(tree) : leastPaths(tree);
      const rel = relative(root, modulePath).replace(/\.dfn$/, '');
      const base = join(settings.mock.out, rel);
      const moduleName = rel.split('/').pop() as string;

      if (style !== 'tokens') {
        files.push({
          path: `${base}.names.md`,
          content: renderNames(moduleName, coverage, paths),
        });
        names += paths.length;
      }
      if (style !== 'names') {
        const tokens = mockTokens(paths, typeOf);
        files.push({
          path: `${base}.mock.tokens.json`,
          content: renderTokens(tokens),
        });
        tokensOut += tokens.length;
        if (breakP > 0) {
          const broken = breakTokens(tokens, breakP, rng(seed));
          files.push({
            path: `${base}.broken.tokens.json`,
            content: renderTokens(broken),
          });
        }
      }
    }

    const parts = [
      `mocked ${files.length} file(s) (${coverage})`,
      style !== 'tokens' ? `${names} name(s)` : null,
      style !== 'names' ? `${tokensOut} token(s)` : null,
      skipped.length > 0 ? `skipped ${skipped.join(', ')}` : null,
    ].filter(Boolean);
    return { summary: parts.join(' — '), files };
  },
};
