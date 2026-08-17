import { copyFile, mkdir, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';

export interface EjectOptions {
  /** A path (`./x.json`) or a package specifier (`@vertekum/schema-dtcg/format.json`). */
  source: string;
  /** Where to write it; defaults to `./schemas/<basename>`. */
  dest?: string;
  projectDir: string;
  force?: boolean;
  write: (line: string) => void;
}

/**
 * `vertekum schema eject`: copy a schema into the working directory so it can be CHANGED.
 *
 * The whole reason schemas became files is that a starting point you cannot edit is not a starting
 * point. This is the command that turns "the vocabulary Atlassian ships" into "the vocabulary this
 * repo enforces", after which it is ordinary source under review like anything else.
 *
 * It takes an explicit source, which is why there is no registry, no discovery list, and no special
 * case for the schemas core bundles — those are real files at a real specifier and eject exactly the
 * way a third party's do.
 */
/**
 * Find the file a source names, from the project first and then from core.
 *
 * The project comes first because a repo's own dependency should win. The fallback through core is
 * what makes the schemas core BUNDLES ejectable: `@vertekum/schema-dtcg` is core's dependency, not
 * the project's, and requiring a repo to install a package it never imports — purely to get a copy
 * of a file that already governs it — would be ceremony with no purpose.
 */
async function resolveSource(
  source: string,
  projectDir: string,
): Promise<string | undefined> {
  // `createRequire` needs a FILE to resolve from; these need not exist. Resolution goes through the
  // package's `exports` map, which is what makes a bare subpath mean `closed/`.
  const bases = [
    resolve(projectDir, 'noop.js'),
    createRequire(import.meta.url).resolve('@vertekum/core/package.json'),
  ];

  for (const base of bases) {
    try {
      const path =
        source.startsWith('.') || isAbsolute(source)
          ? resolve(projectDir, source)
          : createRequire(base).resolve(source);
      await stat(path);
      return path;
    } catch {
      // Try the next base.
    }
  }
  return undefined;
}

export async function runEject(options: EjectOptions): Promise<number> {
  const { source, projectDir, write } = options;

  const from = await resolveSource(source, projectDir);
  if (!from) {
    write(`cannot resolve '${source}' — is the package installed?`);
    return 1;
  }

  const dest = resolve(
    projectDir,
    options.dest ?? `./schemas/${basename(from)}`,
  );

  if (!options.force) {
    const existing = await stat(dest).catch(() => undefined);
    if (existing) {
      write(
        `'${relative(projectDir, dest)}' already exists. Pass --force to overwrite it.`,
      );
      return 1;
    }
  }

  await mkdir(dirname(dest), { recursive: true });
  // Copy the BYTES. An ejected schema should be the file that was shipped, not our reserialization
  // of it — a diff against a later version is only meaningful if the starting point was verbatim.
  await copyFile(from, dest);

  const dir = relative(projectDir, dirname(dest)) || '.';
  write(`wrote ${relative(projectDir, dest)}`);
  write('add to vertekum.config.ts:');
  write(`  { from: './${dir}', use: { '${basename(dest)}': '<glob>' } }`);

  return 0;
}
