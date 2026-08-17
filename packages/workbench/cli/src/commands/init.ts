import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  CONFIG_TEMPLATE,
  SEED_RESOLVER,
  SEED_SET,
  SKILL_TEMPLATE,
} from '../templates/index';

export interface InitOptions {
  dir: string;
  /** Overwrite an existing `vertekum.config.ts`. */
  force?: boolean;
  /** Write the agent skill into `.claude/skills/`. Default true. */
  skill?: boolean;
}

function write(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

/**
 * `vertekum init`: scaffold a consuming repo — config, a seed collection, a resolver, and the agent
 * skill. It runs where no project exists yet, so it sits with `dev` in the CLI's project-exempt set
 * rather than going through `loadProject`.
 *
 * The skill is written by `init` because an npm package cannot install one: it has to land in the
 * consumer's `.claude/skills/`. Re-running with `--force` is how an upgrade refreshes it.
 */
export async function runInit(options: InitOptions): Promise<number> {
  const configPath = join(options.dir, 'vertekum.config.ts');
  if (existsSync(configPath) && !options.force) {
    process.stderr.write(
      `${configPath} already exists. Pass --force to overwrite.\n`,
    );
    return 1;
  }

  const written = ['vertekum.config.ts', 'tokens/core.json'];
  write(configPath, CONFIG_TEMPLATE);
  write(join(options.dir, 'tokens/core.json'), SEED_SET);
  write(join(options.dir, 'tokens/default.resolver.json'), SEED_RESOLVER);
  written.push('tokens/default.resolver.json');

  if (options.skill !== false) {
    const skillPath = '.claude/skills/vertekum-tokens/SKILL.md';
    write(join(options.dir, skillPath), SKILL_TEMPLATE);
    written.push(skillPath);
  }

  process.stdout.write(
    `initialized a Vertekum project in ${options.dir}\n${written
      .map((f) => `  ${f}\n`)
      .join('')}\nnext: npx vertekum check\n`,
  );
  return 0;
}
