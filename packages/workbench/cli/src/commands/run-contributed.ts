import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative } from 'node:path';
import type {
  CommandDescriptor,
  CommandResult,
  Diagnostic,
} from '@vertekum/core';
import { Command } from 'commander';
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
export async function newErrors(
  project: Project,
  before: Diagnostic[],
): Promise<Diagnostic[]> {
  const seen = new Set(before.map(signature));
  const after = await collectProposed(project);
  return after.filter((d) => d.severity === 'error' && !seen.has(signature(d)));
}

/**
 * Write a command's declared file artifacts (ADR-0030 amendment): the handler names them, the
 * runner writes them. Confined to the working directory — a path resolving outside it is a
 * contract violation and throws. Shared with `watch`, which runs generators without the CLI's
 * printing path.
 */
export function writeArtifacts(
  project: Project,
  result: CommandResult | undefined,
  options: { dryRun?: boolean } = {},
): string[] {
  const written: string[] = [];
  for (const artifact of result?.files ?? []) {
    const target = join(project.projectDir, artifact.path);
    if (
      isAbsolute(artifact.path) ||
      relative(project.projectDir, target).startsWith('..')
    ) {
      throw new Error(
        `refused: artifact path escapes the working directory: ${artifact.path}`,
      );
    }
    if (!options.dryRun) {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, artifact.content);
    }
    written.push(artifact.path);
  }
  return written;
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

  try {
    files.push(...writeArtifacts(project, result, { dryRun }));
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`);
    return 2;
  }

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

/** What a parsed command line resolves to: the command, its named arguments, its options. */
export interface ParsedCommand {
  descriptor: CommandDescriptor;
  args: Record<string, string>;
  options: Record<string, unknown>;
}

/**
 * Declare every registered command on a program, creating parent commands on demand so
 * 'token rename' becomes `vertekum token rename`. `onAction` receives what commander parsed; the
 * CLI runs it, a batch collects it.
 */
function declareCommands(
  program: Command,
  project: Project,
  onAction: (parsed: ParsedCommand) => Promise<void>,
): void {
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
        // Reuse a command the host already declared (e.g. `schema` exists for `schema eject`) —
        // a duplicate sibling would shadow it and strand its subcommands.
        next =
          parent.commands.find((c) => c.name() === segment) ??
          parent.command(segment).description(`${segment} commands`);
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
    // Options declared by chain links (ctx.commands.extend): declaration is static so the full
    // flag set exists at parse time, before any handler has seen a value.
    for (const extension of project.kernel.commands.extensionsOf(
      descriptor.name,
    )) {
      for (const option of extension.options ?? []) {
        command.option(option.flag, option.description);
      }
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
        if (values[i] !== undefined) named[arg.name] = values[i] as string;
      });
      await onAction({ descriptor, args: named, options });
    });
  }
}

/** Attach every contributed command to the program, each run by the runner. */
export function attachCommands(program: Command, project: Project): void {
  declareCommands(program, project, async ({ descriptor, args, options }) => {
    process.exitCode = await runContributed({
      project,
      command: descriptor,
      args,
      options,
    });
  });
}

/** The host's own verbs: they report, serve or scaffold, and none can run inside a batch. */
const HOST_VERBS = new Set([
  'build',
  'check',
  'describe',
  'watch',
  'init',
  'dev',
  'batch',
  'migrate',
]);

/** The runner-owned flags. Inside a batch they belong to the batch, never to one line. */
const BATCH_FLAGS: Array<[string, string]> = [
  ['dryRun', '--dry-run'],
  ['json', '--json'],
  ['cwd', '--cwd'],
];

/**
 * Parse one argument vector into the command it names, WITHOUT running it — exactly the parsing
 * the CLI does, so a batch line means what it would mean typed. A fresh program per call:
 * commander keeps option values between parses. Throws a usage error naming the problem.
 */
export async function parseCommandLine(
  project: Project,
  argv: string[],
): Promise<ParsedCommand> {
  const first = argv[0];
  if (first !== undefined && HOST_VERBS.has(first)) {
    throw new Error(
      `'${first}' can't run in a batch — only commands that change tokens can`,
    );
  }
  let parsed: ParsedCommand | undefined;
  const program = new Command('vertekum');
  program.exitOverride();
  // Usage errors become the thrown message, not stderr noise.
  const quiet = { writeOut: () => {}, writeErr: () => {} };
  program.configureOutput(quiet);
  declareCommands(program, project, async (result) => {
    parsed = result;
  });
  const silence = (command: Command): void => {
    command.exitOverride();
    command.configureOutput(quiet);
    for (const sub of command.commands) silence(sub);
  };
  silence(program);
  try {
    await program.parseAsync(argv, { from: 'user' });
  } catch (error) {
    const message = (error as Error).message.replace(/^error: /, '');
    throw new Error(message);
  }
  if (!parsed) {
    throw new Error(`'${argv.join(' ')}' is not a command`);
  }
  for (const [key, flag] of BATCH_FLAGS) {
    if ((parsed as ParsedCommand).options[key] !== undefined) {
      throw new Error(`${flag} belongs to the batch, not to a line`);
    }
  }
  return parsed;
}
