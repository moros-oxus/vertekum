import { execFile } from 'node:child_process';
import { readFile, realpath, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);

/** Run a git subcommand in `cwd`, returning stdout. Throws on non-zero exit. */
async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await exec('git', args, {
    cwd,
    maxBuffer: 1024 * 1024 * 16,
  });
  return stdout;
}

const SEMVER = /^\d+\.\d+\.\d+/;

/** Highest `v*` version tag by git's native version sort, or null when the repo has none. */
export async function latestVersionTag(
  repoCwd: string,
): Promise<{ tag: string; version: string } | null> {
  const out = await git(repoCwd, [
    'tag',
    '--list',
    'v*',
    '--sort=-version:refname',
  ]);
  for (const raw of out.split('\n')) {
    const tag = raw.trim();
    if (tag && SEMVER.test(tag.slice(1))) return { tag, version: tag.slice(1) };
  }
  return null;
}

/** The token collection dir's `*.json` files as they were at `ref`, parsed to raw objects. */
export async function collectionAtRef(
  repoCwd: string,
  collectionDir: string,
  ref: string,
): Promise<Record<string, unknown>> {
  // realpath both sides: git's toplevel is realpath'd (/private/var/…) while the caller's dir may
  // be the symlink form (/var/…); a lexical relative between the two would escape the repo.
  const root = await realpath(
    (await git(repoCwd, ['rev-parse', '--show-toplevel'])).trim(),
  );
  const rel = relative(root, await realpath(collectionDir)); // '' when collection IS repo root
  const treeish = rel ? `${ref}:${rel}` : ref;
  const list = await git(repoCwd, ['ls-tree', '--name-only', treeish]);
  const files: Record<string, unknown> = {};
  for (const raw of list.split('\n')) {
    const name = raw.trim();
    if (!name.endsWith('.json')) continue;
    if (name.endsWith('.resolver.json')) continue; // composition, not token values
    const path = rel ? `${rel}/${name}` : name;
    files[name] = JSON.parse(await git(repoCwd, ['show', `${ref}:${path}`]));
  }
  return files;
}

export interface ReleaseAtHeadOpts {
  projectDir: string;
  collectionDir: string;
  changelogPath: string | null;
  version: string;
  commit: false | { message: string };
  tag: boolean;
  bumpPackage: boolean;
}

/** Perform the enabled release actions at HEAD: optional package bump, commit, and annotated tag. */
export async function releaseAtHead(
  repoCwd: string,
  o: ReleaseAtHeadOpts,
): Promise<void> {
  // Stage cwd-relative pathspecs, never absolute paths: on macOS an absolute worktree path can
  // trip git's "outside repository" check when /var resolves to /private/var, whereas a pathspec
  // relative to `repoCwd` is resolved within the worktree regardless of symlinks.
  const rel = (p: string) => relative(repoCwd, p) || '.';
  const stage: string[] = [rel(o.collectionDir)];
  if (o.changelogPath) stage.push(rel(join(o.projectDir, o.changelogPath)));

  if (o.bumpPackage) {
    const pkgPath = join(o.projectDir, 'package.json');
    const text = await readFile(pkgPath, 'utf8').catch(() => null);
    if (text !== null) {
      const pkg = JSON.parse(text);
      pkg.version = o.version;
      await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
      stage.push(rel(pkgPath));
    }
  }

  if (o.commit) {
    await git(repoCwd, ['add', '--', ...stage]);
    await git(repoCwd, ['commit', '-m', o.commit.message]);
  }
  if (o.tag) {
    const message = o.commit ? o.commit.message : `Release v${o.version}`;
    await git(repoCwd, ['tag', '-a', `v${o.version}`, '-m', message]);
  }
}
