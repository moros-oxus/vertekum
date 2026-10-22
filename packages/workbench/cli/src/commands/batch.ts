import type { CommandResult } from '@vertekum/core';
import type { Project } from '../loadProject';
import { saveProject } from '../saveProject';
import { readBatch } from './batch-input';
import { collectProposed, formatDiagnostic } from './check';
import {
  newErrors,
  type ParsedCommand,
  parseCommandLine,
  writeArtifacts,
} from './run-contributed';

/**
 * `vertekum batch <file>` — several commands against one in-memory project, validated once and
 * written once. All or nothing: every line is parsed before anything runs (a bad one exits 2), the
 * commands run in order (one that fails stops the batch, exit 1), and the end state is checked by
 * the single-verb rule — it may not introduce an error. Intermediate states are free to break
 * rules; that is the point. Nothing is written unless the whole batch passes, so `--dry-run`
 * previews an entire sequence.
 */
export async function runBatch(input: {
  project: Project;
  text: string;
  json?: boolean;
  dryRun?: boolean;
}): Promise<number> {
  const { project, json = false, dryRun = false } = input;
  const usage = (message: string): number => {
    process.stderr.write(`${message}\n`);
    return 2;
  };

  // 1. Parse everything first.
  let steps: ReturnType<typeof readBatch>;
  try {
    steps = readBatch(input.text);
  } catch (error) {
    return usage((error as Error).message);
  }
  if (steps.length === 0) return usage('the batch has no commands');
  const parsed: Array<ParsedCommand & { line: number }> = [];
  for (const step of steps) {
    try {
      parsed.push({
        line: step.line,
        ...(await parseCommandLine(project, step.argv)),
      });
    } catch (error) {
      return usage(`line ${step.line}: ${(error as Error).message}`);
    }
  }

  // 2. Run in order, on one document.
  const before = project.document.getVersion();
  const priorDiagnostics = await collectProposed(project);
  const results: Array<{
    line: number;
    command: string;
    result: CommandResult | undefined;
  }> = [];
  for (const step of parsed) {
    try {
      const result =
        (await step.descriptor.run({
          project,
          args: step.args,
          options: step.options,
        })) ?? undefined;
      results.push({ line: step.line, command: step.descriptor.name, result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (json) {
        process.stdout.write(
          `${JSON.stringify({ ok: false, command: 'batch', line: step.line, error: message }, null, 2)}\n`,
        );
      } else {
        process.stderr.write(
          `line ${step.line} (${step.descriptor.name}): ${message} — nothing written\n`,
        );
      }
      return 1;
    }
  }

  // 3. Validate once, at the end.
  const mutated = project.document.getVersion() !== before;
  if (mutated) {
    const introduced = await newErrors(project, priorDiagnostics);
    if (introduced.length > 0) {
      if (json) {
        process.stdout.write(
          `${JSON.stringify(
            {
              ok: false,
              command: 'batch',
              error: 'refused: the batch would introduce errors',
              diagnostics: introduced,
            },
            null,
            2,
          )}\n`,
        );
      } else {
        process.stderr.write(
          `refused — this batch would introduce ${introduced.length} error(s); nothing written:\n`,
        );
        for (const d of introduced) {
          process.stderr.write(`  ${formatDiagnostic(d)}\n`);
        }
      }
      return 1;
    }
  }

  // 4. Write once: artifact paths are checked before any file is touched.
  try {
    for (const { result } of results) {
      writeArtifacts(project, result, { dryRun: true });
    }
  } catch (error) {
    return usage((error as Error).message);
  }
  const files = mutated ? await saveProject(project, { dryRun }) : [];
  for (const { result } of results) {
    files.push(...writeArtifacts(project, result, { dryRun }));
  }

  if (json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          command: 'batch',
          dryRun,
          files,
          results: results.map(({ line, command, result }) => ({
            line,
            command,
            summary: result?.summary ?? null,
            data: result?.data ?? null,
          })),
        },
        null,
        2,
      )}\n`,
    );
  } else {
    for (const { line, result } of results) {
      if (result?.summary) process.stdout.write(`${line}: ${result.summary}\n`);
    }
    for (const file of files) {
      process.stdout.write(`${dryRun ? 'would write' : 'wrote'} ${file}\n`);
    }
  }
  return 0;
}
