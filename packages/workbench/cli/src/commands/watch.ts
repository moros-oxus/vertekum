import { type FSWatcher, watch as fsWatch } from 'node:fs';
import { resolve } from 'node:path';
import {
  type Diagnostic,
  EXPORTER_SERVICE,
  type ExporterService,
  runTargets,
} from '@vertekum/core';
import { writeTextFile } from '@vertekum/core/node';
import { loadProject, type Project } from '../loadProject';
import { readTargets } from './build';
import { collectDiagnostics, formatDiagnostic } from './check';
import { writeArtifacts } from './run-contributed';

/**
 * `vertekum watch`: one ordered pass on every change — reload, generators, check, targets.
 *
 * A fourth verb rather than `build --watch`, because `build` terminates with a meaningful exit
 * code that CI and agents depend on, and rather than `dev`, which means Vite plus the bridge. The
 * loop writes files and nothing else: whoever watches those files (Vite, and so Ladle) reacts.
 */

export interface WatchOptions {
  /** The project directory — reloaded from disk on every pass. */
  cwd: string;
  target?: string[];
  /** Emit one JSON event per line on stdout instead of human progress on stderr. */
  json?: boolean;
  /** Quiet period before a pass starts; a multi-file save is then one rebuild. */
  debounceMs?: number;
}

export interface PassResult {
  ok: boolean;
  /** Paths written this pass, relative to the project dir. */
  files: string[];
  diagnostics: Diagnostic[];
  ms: number;
  /** Set when a generator threw or the project failed to load. */
  error?: string;
}

const DEBOUNCE_MS = 120;

/**
 * One pass. Generators run first and their artifacts ARE written — a built schema is an input to
 * the check that follows, so the project is reloaded to pick them up. Export targets are written
 * only when the check passes, which is what keeps the last good output on disk for a consumer.
 */
export async function runPass(options: WatchOptions): Promise<PassResult> {
  const started = Date.now();
  const files: string[] = [];
  const done = (rest: Omit<PassResult, 'files' | 'ms'>): PassResult => ({
    ...rest,
    files,
    ms: Date.now() - started,
  });

  let project: Project;
  try {
    project = await loadProject(options.cwd, { fresh: true });
  } catch (error) {
    return done({
      ok: false,
      diagnostics: [],
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const generators = project.kernel.commands
    .list()
    .filter((command) => command.generator);
  for (const command of generators) {
    try {
      const result =
        (await command.run({ project, args: {}, options: {} })) ?? undefined;
      files.push(...writeArtifacts(project, result));
    } catch (error) {
      return done({
        ok: false,
        diagnostics: [],
        error: `${command.name}: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  // Generators write what the validators read, so the project is reloaded before checking.
  if (files.length > 0) {
    project = await loadProject(options.cwd, { fresh: true });
  }

  const diagnostics = await collectDiagnostics(project);
  if (diagnostics.some((d) => d.severity === 'error')) {
    return done({ ok: false, diagnostics });
  }

  const registry =
    project.kernel.services.get<ExporterService>(EXPORTER_SERVICE);
  if (!registry || registry.list().length === 0) {
    return done({ ok: true, diagnostics });
  }

  const results = await runTargets(readTargets(project), {
    registry,
    tokens: project.document.getAllTokens(),
    resolvers: project.document.getResolvers(),
    files: project.document.getFiles(),
    only: options.target,
    extensions: project.kernel.commands.extensionsOf('build'),
  });
  for (const result of results) {
    for (const file of result.files) {
      const path = `${result.target.out}/${file.path}`;
      await writeTextFile(project.projectDir, path, file.content);
      files.push(path);
    }
  }
  return done({ ok: true, diagnostics });
}

/** Every path a pass watches: the collection, the config, and what each generator reads. */
export function watchPaths(project: Project): string[] {
  const paths = new Set<string>([project.collectionDir]);
  if (project.configPath) paths.add(project.configPath);
  for (const command of project.kernel.commands.list()) {
    for (const path of command.generator?.reads({ project }) ?? []) {
      paths.add(path);
    }
  }
  return [...paths];
}

/**
 * The debouncing, self-ignoring event loop.
 *
 * A pass writes into directories it also watches — generated schemas most obviously — so every
 * path it wrote is remembered and the events those writes raise are dropped. Without that the
 * loop feeds itself forever.
 */
export async function runWatch(options: WatchOptions): Promise<number> {
  const debounceMs = options.debounceMs ?? DEBOUNCE_MS;
  const emit = (event: Record<string, unknown>): void => {
    if (options.json) {
      process.stdout.write(`${JSON.stringify(event)}\n`);
    }
  };
  const log = (line: string): void => {
    if (!options.json) process.stderr.write(`${line}\n`);
  };

  const report = (result: PassResult, trigger?: string): void => {
    emit({
      event: 'pass',
      ok: result.ok,
      ms: result.ms,
      ...(trigger ? { trigger } : {}),
      files: result.files,
      ...(result.error ? { error: result.error } : {}),
      ...(result.diagnostics.length ? { diagnostics: result.diagnostics } : {}),
    });
    if (result.ok) {
      log(`rebuilt ${result.files.length} file(s) in ${result.ms}ms`);
      return;
    }
    if (result.error) log(result.error);
    for (const diagnostic of result.diagnostics) {
      log(formatDiagnostic(diagnostic));
    }
    log('kept the last good output; still watching');
  };

  let written = new Set<string>();
  const first = await runPass(options);
  written = new Set(first.files.map((p) => resolve(options.cwd, p)));
  report(first);

  // Paths come from a loaded project; if the first pass could not load one, there is nothing to
  // watch and the invocation — not the tokens — is what is wrong.
  let project: Project;
  try {
    project = await loadProject(options.cwd, { fresh: true });
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    return 2;
  }

  const paths = watchPaths(project);
  emit({ event: 'watching', paths });
  log(`watching ${paths.length} path(s); ctrl-c to stop`);

  const watchers: FSWatcher[] = [];
  let timer: NodeJS.Timeout | undefined;
  let pending: string | undefined;
  let running = false;

  const schedule = (trigger: string): void => {
    pending = trigger;
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      if (running) return;
      running = true;
      const fired = pending;
      pending = undefined;
      written = new Set();
      const result = await runPass(options);
      written = new Set(result.files.map((p) => resolve(options.cwd, p)));
      report(result, fired);
      running = false;
    }, debounceMs);
  };

  for (const path of paths) {
    try {
      watchers.push(
        fsWatch(path, { recursive: true }, (_event, filename) => {
          const changed = filename ? resolve(path, filename) : path;
          // Our own writes raised this: dropping them is what stops the loop feeding itself.
          if (written.has(changed)) return;
          schedule(changed);
        }),
      );
    } catch {
      log(`cannot watch ${path} — skipped`);
    }
  }

  return await new Promise<number>((done) => {
    const stop = (): void => {
      if (timer) clearTimeout(timer);
      for (const watcher of watchers) watcher.close();
      log('stopped');
      done(0);
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  });
}
