import {
  EXPORTER_SERVICE,
  type ExporterService,
  runTargets,
  type Target,
  targetId,
} from '@vertekum/core';
import { writeTextFile } from '@vertekum/core/node';
import type { Project } from '../loadProject';
import { collectDiagnostics, formatDiagnostic } from './check';

/**
 * The configured export targets (ADR-0018): the config ROOT's `targets` — the ONE location. A
 * runner concern, so it belongs to no exporter extension; the old `vtk.export` settings location
 * fed the (deferred) app route and is no longer consulted.
 */
export function readTargets(project: Project): Target[] {
  return project.targets ?? [];
}

export interface BuildOptions {
  project: Project;
  target?: string[];
  dryRun?: boolean;
  json?: boolean;
  /** `false` (via `--no-check`) skips the implied validation pass. */
  check?: boolean;
}

/** `vertekum build`: run the configured targets and write their files. Returns the exit code. */
export async function runBuild(options: BuildOptions): Promise<number> {
  const project = options.project;
  const targets = readTargets(project);

  if (options.target) {
    const known = new Set(targets.map(targetId));
    const unknown = options.target.filter((id) => !known.has(id));
    if (unknown.length > 0) {
      process.stderr.write(`unknown target: ${unknown.join(', ')}\n`);
      return 2;
    }
  }

  // build implies check (ADR-0030): an agent that only knows `build` must not be able to emit
  // output from a broken collection. Warnings never block.
  if (options.check !== false) {
    const diagnostics = await collectDiagnostics(project);
    const errors = diagnostics.filter((d) => d.severity === 'error');
    if (errors.length > 0) {
      if (options.json) {
        process.stdout.write(
          `${JSON.stringify({ ok: false, errors: errors.length, diagnostics }, null, 2)}\n`,
        );
      } else {
        for (const diagnostic of diagnostics) {
          process.stderr.write(`${formatDiagnostic(diagnostic)}\n`);
        }
        process.stderr.write(
          '\nbuild refused: fix the errors above or pass --no-check\n',
        );
      }
      return 1;
    }
  }

  const registry =
    project.kernel.services.get<ExporterService>(EXPORTER_SERVICE);
  // The kernel seeds the registry, so it exists — what can be missing is exporters IN it.
  if (!registry || registry.list().length === 0) {
    process.stderr.write(
      'no exporters registered: add an exporter extension (e.g. @vertekum/ext-export-css or @vertekum/ext-export-terrazzo)\n',
    );
    return 2;
  }

  const results = await runTargets(targets, {
    registry,
    tokens: project.document.getAllTokens(),
    resolvers: project.document.getResolvers(),
    files: project.document.getFiles(),
    only: options.target,
    // The build command's extension chain: handlers present tokens at interchange (core
    // consults them once per staged token), so a custom type reaches every exporter.
    extensions: project.kernel.commands.extensionsOf('build'),
  });

  if (!options.dryRun) {
    for (const result of results) {
      for (const file of result.files) {
        await writeTextFile(
          project.projectDir,
          `${result.target.out}/${file.path}`,
          file.content,
        );
      }
    }
  }

  const payload = {
    ok: true,
    dryRun: options.dryRun === true,
    targets: results.map((r) => ({
      id: r.id,
      exporter: r.target.exporter,
      composition: r.target.composition ?? null,
      files: r.files.map((f) => ({
        path: `${r.target.out}/${f.path}`,
        bytes: Buffer.byteLength(f.content, 'utf8'),
      })),
    })),
  };

  if (options.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else if (results.length === 0) {
    process.stdout.write('no targets configured\n');
  } else {
    for (const target of payload.targets) {
      for (const file of target.files) {
        process.stdout.write(
          `${options.dryRun ? 'would write' : 'wrote'} ${file.path}\n`,
        );
      }
    }
  }
  return 0;
}
