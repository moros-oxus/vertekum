import {
  type Baseline,
  parseCollection,
  type ReleaseArtifacts,
  type ReleaseProvider,
} from 'vertekum';
import { writeChangelog } from './changelog';
import type { FileClient } from './fileClient';
import type { GitClient } from './gitClient';
import type { ChangelogConfig, CommitInfo, GitOptions } from './index';

export interface GitProviderDeps {
  gitClient: GitClient;
  fileClient: FileClient;
  /** Read at call time so config/user overrides are honored. */
  changelog: () => ChangelogConfig;
  git: () => GitOptions;
}

/**
 * Git ReleaseProvider: the baseline is the token collection at the last version tag (read-only);
 * the write is hands-off (changelog only) unless the commit/tag/bumpPackage toggles opt in. Git owns
 * history and tags; the app adds the semantic layer.
 */
export function createGitReleaseProvider(
  deps: GitProviderDeps,
): ReleaseProvider {
  return {
    async readBaseline(): Promise<Baseline | null> {
      const latest = await deps.gitClient.latestRelease();
      if (!latest) return null;
      const files = await deps.gitClient.collectionAtRef(latest.tag);
      return { version: latest.version, tokens: parseCollection(files) };
    },
    async writeRelease(artifacts: ReleaseArtifacts): Promise<void> {
      const cl = deps.changelog();
      if (cl !== false)
        await writeChangelog(
          deps.fileClient,
          cl.changelogPath,
          artifacts.notes,
        );

      const g = deps.git();
      const info: CommitInfo = {
        version: artifacts.version,
        bump: artifacts.notes.bump,
        notes: artifacts.notes,
      };
      const commit =
        typeof g.commit === 'function'
          ? { message: g.commit(info) }
          : g.commit
            ? { message: `Release v${artifacts.version}` }
            : false;

      if (commit || g.tag || g.bumpPackage) {
        await deps.gitClient.release({
          version: artifacts.version,
          commit,
          tag: g.tag,
          bumpPackage: g.bumpPackage,
          changelogPath: cl === false ? null : cl.changelogPath,
        });
      }
    },
  };
}
