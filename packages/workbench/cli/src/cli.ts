import { Command } from 'commander';
import { runBuild } from './commands/build';
import { runCheck } from './commands/check';
import { runDescribe } from './commands/describe';
import { runEject } from './commands/eject';
import { runInit } from './commands/init';
import { runMigrate } from './commands/migrate';
import { attachCommands } from './commands/run-contributed';
import { findConfig } from './findConfig';
import { loadProject, type Project } from './loadProject';

/**
 * Read `--cwd` before commander parses: the project must load first, because contributed commands
 * only exist once the extension graph has activated. The flag stays declared on each subcommand so
 * it shows in help — commander requires program-level options to precede the subcommand, so
 * hoisting it would break `vertekum build --cwd X`.
 */
function cwdFromArgv(argv: string[]): string {
  const index = argv.indexOf('--cwd');
  const value = index >= 0 ? argv[index + 1] : undefined;
  return value ?? process.cwd();
}

/**
 * The command table (ADR-0030). Built-in verbs plus whatever extensions contributed. stdout is data
 * and stderr is logs, so `--json` output stays pipeable. Only `dev` loads Vite, and it does so lazily.
 */
export function createProgram(project: Project | undefined): Command {
  const program = new Command('vertekum');
  program.exitOverride();

  program
    .command('dev')
    .description('launch the Vertekum UI (Vite + bridge server)')
    .action(async () => {
      const { runDev } = await import('./run');
      await runDev();
    });

  program
    .command('init')
    .description(
      'scaffold a Vertekum project: config, seed tokens, agent skill',
    )
    .option('--force', 'overwrite an existing vertekum.config.ts')
    .option('--no-skill', 'skip writing the agent skill')
    .option('--cwd <dir>', 'directory to initialize')
    .action(async (options) => {
      process.exitCode = await runInit({
        dir: options.cwd ?? process.cwd(),
        force: options.force,
        skill: options.skill,
      });
    });

  const withProject = async (
    action: (project: Project) => Promise<number>,
  ): Promise<void> => {
    if (!project) {
      process.stderr.write('no vertekum config found\n');
      process.exitCode = 2;
      return;
    }
    process.exitCode = await action(project);
  };

  program
    .command('build')
    .description('run the configured export targets and write their files')
    .option('--target <id...>', 'only these target ids')
    .option('--dry-run', 'print what would be written without writing')
    .option('--no-check', 'skip the implied validation pass')
    .option('--json', 'emit machine-readable output')
    .option('--cwd <dir>', 'project directory')
    .action((options) =>
      withProject((p) =>
        runBuild({
          project: p,
          target: options.target,
          dryRun: options.dryRun,
          check: options.check,
          json: options.json,
        }),
      ),
    );

  program
    .command('check')
    .description('run every registered validator and report diagnostics')
    .option('--json', 'emit machine-readable output')
    .option('--cwd <dir>', 'project directory')
    .action((options) =>
      withProject((p) => runCheck({ project: p, json: options.json })),
    );

  program
    .command('describe')
    .description('print the live inventory: extensions, exporters, validators')
    .option('--json', 'emit machine-readable output')
    .option('--with-ui', 'also load UI surfaces and include routes')
    .option('--cwd <dir>', 'project directory')
    .action((options) =>
      withProject((p) =>
        runDescribe({
          project: p,
          json: options.json,
          withUi: options.withUi,
        }),
      ),
    );

  program
    .command('migrate')
    .command('values')
    .description(
      'convert stored string values to 2025.10 object notation, by effective type',
    )
    .option('--dry-run', 'print what would change without writing')
    .option('--cwd <dir>', 'project directory')
    .action((options) =>
      withProject((p) => runMigrate({ project: p, dryRun: options.dryRun })),
    );

  program
    .command('schema')
    .command('eject <source> [dest]')
    .description(
      'copy a schema into the working directory so it can be changed',
    )
    .option('--force', 'overwrite an existing file')
    .option('--cwd <dir>', 'project directory')
    // Deliberately NOT `withProject`: ejecting a schema is something you may do before there is a
    // config to eject it into, and refusing until one exists would be ceremony for its own sake.
    .action(async (source, dest, options) => {
      process.exitCode = await runEject({
        source,
        dest,
        projectDir: project?.projectDir ?? options.cwd ?? process.cwd(),
        force: options.force,
        write: (line) => process.stdout.write(`${line}\n`),
      });
    });

  // Contributed commands exist only when a project loaded, so help outside a project is honest
  // about what is actually available here — the property that makes `describe` worth having.
  if (project) attachCommands(program, project);

  return program;
}

/** Entry point used by `bin/vertekum.mjs`. Usage errors exit 2; the work's own failures exit 1. */
export async function run(argv: string[]): Promise<void> {
  const cwd = cwdFromArgv(argv);
  // `dev` loads its own config through Vite; `init` runs where no project exists yet. Both would
  // otherwise pay for — or fail on — a project load they never use.
  const projectExempt = argv[0] === 'dev' || argv[0] === 'init';
  const project =
    !projectExempt && findConfig(cwd) ? await loadProject(cwd) : undefined;

  try {
    await createProgram(project).parseAsync(argv, { from: 'user' });
  } catch (error) {
    const code = (error as { exitCode?: number }).exitCode;
    if (typeof code === 'number') {
      process.exitCode = code === 0 ? 0 : 2;
      return;
    }
    throw error;
  }
}
