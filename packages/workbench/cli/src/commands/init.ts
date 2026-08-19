import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  CONFIG_TEMPLATE,
  RELEASE_SKILL_TEMPLATE,
  SEED_RESOLVER,
  SEED_SET,
  SKILL_STAMP,
  SKILL_TEMPLATE,
} from '../templates/index';

export interface InitOptions {
  dir: string;
  /** Overwrite an existing `vertekum.config.ts`. */
  force?: boolean;
  /** Write the agent skills into `.claude/skills/`. Default true. */
  skill?: boolean;
  /** Refresh ONLY the skills: no config check, no seed files. */
  skillOnly?: boolean;
}

/** The grouped skill set: `.claude/skills/vertekum/<name>` is invoked as `/vertekum:<name>`. */
const SKILLS: ReadonlyArray<{ path: string; content: string }> = [
  { path: '.claude/skills/vertekum/tokens/SKILL.md', content: SKILL_TEMPLATE },
  {
    path: '.claude/skills/vertekum/release/SKILL.md',
    content: RELEASE_SKILL_TEMPLATE,
  },
];

function write(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

/**
 * Write the skill set. A file that exists WITHOUT the stamp has been taken over by the consumer
 * (removing the stamp is the documented opt-out), so it is skipped with a notice, never
 * overwritten. Returns the repo-relative paths actually written.
 */
function writeSkills(dir: string): string[] {
  const written: string[] = [];
  for (const skill of SKILLS) {
    const target = join(dir, skill.path);
    if (
      existsSync(target) &&
      !readFileSync(target, 'utf8').includes(SKILL_STAMP)
    ) {
      process.stderr.write(
        `${skill.path} has local edits (no stamp) — left as is.\n`,
      );
      continue;
    }
    write(target, skill.content);
    written.push(skill.path);
  }
  return written;
}

/**
 * `vertekum init`: scaffold a consuming repo — config, a seed collection, a resolver, and the
 * agent skills. It runs where no project exists yet, so it sits with `dev` in the CLI's
 * project-exempt set rather than going through `loadProject`.
 *
 * The skills are written by `init` because an npm package cannot install one: they have to land
 * in the consumer's `.claude/skills/`. `init --skill` refreshes them alone — it never touches the
 * config or seed files, so an upgrade does not put a real project's config at risk.
 */
export async function runInit(options: InitOptions): Promise<number> {
  if (options.skillOnly) {
    const written = writeSkills(options.dir);
    process.stdout.write(
      `refreshed the Vertekum agent skills in ${options.dir}\n${written
        .map((f) => `  ${f}\n`)
        .join('')}`,
    );
    return 0;
  }

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
    written.push(...writeSkills(options.dir));
  }

  process.stdout.write(
    `initialized a Vertekum project in ${options.dir}\n${written
      .map((f) => `  ${f}\n`)
      .join('')}\nnext: npx vertekum check\n`,
  );
  return 0;
}
