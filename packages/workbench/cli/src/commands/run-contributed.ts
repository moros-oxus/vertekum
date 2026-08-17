import type {
  CommandDescriptor,
  CommandResult,
  Diagnostic,
} from '@vertekum/core';
import type { Command } from 'commander';
import type { Project } from '../loadProject';
import { saveProject } from '../saveProject';
import { collectProposed, formatDiagnostic } from './check';

/** Identity of a diagnostic, for telling a NEW problem from one that was already there. */
function signature(d: Diagnostic): string {
  return `${d.code}|${d.file ?? ''}|${d.pointer ?? ''}|${d.message}`;
}

/**
 * Errors this mutation would introduce.
 *
 * Compared against the state before the command ran, deliberately. A repo that already has problems
 * must stay workable — refusing every verb because an unrelated error exists elsewhere would make
 * the tool unusable exactly when it is most needed. The rule is narrower and honest: you may not
 * make it worse.
 */
async function newErrors(
  project: Project,
  before: Diagnostic[],
): Promise<Diagnostic[]> {
  const seen = new Set(before.map(signature));
  const after = await collectProposed(project);
  return after.filter((d) => d.severity === 'error' && !seen.has(signature(d)));
}

/**
 * Run one contributed command (ADR-0030 amendment). The runner owns persistence, `--dry-run` and
 * `--json`, so no handler implements them and a third-party command cannot invent its own write
 * path. A handler mutates `project.document` and returns; the runner notices the version changed.
 */
export async function runContributed(input: {
  project: Project;
  command: CommandDescriptor;
  args: Record<string, string>;
  options: Record<string, unknown>;
}): Promise<number> {
  const { project, command, args, options } = input;
  const json = options.json === true;
  const dryRun = options.dryRun === true;
  const before = project.document.getVersion();
  // Captured before the handler runs, so a pre-existing problem is not blamed on this command.
  const priorDiagnostics = await collectProposed(project);

  let result: CommandResult | undefined;
  try {
    result = (await command.run({ project, args, options })) ?? undefined;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (json) {
      process.stdout.write(
        `${JSON.stringify({ ok: false, command: command.name, error: message }, null, 2)}\n`,
      );
    } else {
      process.stderr.write(`${message}\n`);
    }
    return 1;
  }

  const mutated = project.document.getVersion() !== before;

  // A verb must not be able to write a document that violates the project's own rules. Checking
  // here — once, in the runner — means every command gets it, including contributed ones, and no
  // handler has to remember.
  if (mutated) {
    const introduced = await newErrors(project, priorDiagnostics);
    if (introduced.length > 0) {
      if (json) {
        process.stdout.write(
          `${JSON.stringify(
            {
              ok: false,
              command: command.name,
              error: 'refused: the change would introduce errors',
              diagnostics: introduced,
            },
            null,
            2,
          )}\n`,
        );
      } else {
        process.stderr.write(
          `refused — this change would introduce ${introduced.length} error(s):\n`,
        );
        for (const d of introduced) {
          process.stderr.write(`  ${formatDiagnostic(d)}\n`);
        }
      }
      return 1;
    }
  }

  const files = mutated ? await saveProject(project, { dryRun }) : [];

  if (json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          command: command.name,
          dryRun,
          files,
          data: result?.data ?? null,
        },
        null,
        2,
      )}\n`,
    );
  } else {
    if (result?.summary) process.stdout.write(`${result.summary}\n`);
    for (const file of files) {
      process.stdout.write(`${dryRun ? 'would write' : 'wrote'} ${file}\n`);
    }
  }
  return 0;
}

/**
 * Attach every contributed command to the program, creating parent commands on demand so
 * 'token rename' becomes `vertekum token rename`.
 */
export function attachCommands(program: Command, project: Project): void {
  const parents = new Map<string, Command>();

  for (const descriptor of project.kernel.commands.list()) {
    const segments = descriptor.name.split(' ');
    const leaf = segments.pop() as string;

    let parent = program;
    const trail: string[] = [];
    for (const segment of segments) {
      trail.push(segment);
      const key = trail.join(' ');
      let next = parents.get(key);
      if (!next) {
        next = parent.command(segment).description(`${segment} commands`);
        parents.set(key, next);
      }
      parent = next;
    }

    const args = (descriptor.args ?? [])
      .map((a) => (a.required === false ? `[${a.name}]` : `<${a.name}>`))
      .join(' ');
    const command = parent
      .command(args ? `${leaf} ${args}` : leaf)
      .description(descriptor.description);

    for (const option of descriptor.options ?? []) {
      command.option(option.flag, option.description);
    }
    command.option('--dry-run', 'make no changes on disk');
    command.option('--json', 'emit machine-readable output');
    // Declared so it appears in help and is not rejected as unknown; the value is read from argv
    // before parsing, since the project must load to build this tree.
    command.option('--cwd <dir>', 'project directory');

    command.action(async (...actionArgs: unknown[]) => {
      // commander hands positionals in order, then the options object, then the Command.
      const count = descriptor.args?.length ?? 0;
      const values = actionArgs.slice(0, count);
      const options = actionArgs[count] as Record<string, unknown>;
      const named: Record<string, string> = {};
      (descriptor.args ?? []).forEach((arg, i) => {
        named[arg.name] = values[i] as string;
      });
      process.exitCode = await runContributed({
        project,
        command: descriptor,
        args: named,
        options,
      });
    });
  }
}
