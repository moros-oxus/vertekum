import type { Baseline, ReleaseArtifacts, ReleaseProvider } from 'vertekum';
import { writeChangelog } from './changelog';
import type { FileClient } from './fileClient';
import type { ChangelogConfig } from './index';

export interface LockProviderDeps {
  client: FileClient;
  /** Read at call time so config/user overrides are honored. */
  lockPath: () => string;
  changelog: () => ChangelogConfig;
}

/**
 * Lock-file ReleaseProvider (ADR-0008): the baseline is a committed, normalized snapshot; a release
 * writes the snapshot + (if enabled) a changelog section. "Full control" mode — the app computes and
 * writes; the git commit/tag stays the user's.
 */
export function createLockFileReleaseProvider(
  deps: LockProviderDeps,
): ReleaseProvider {
  return {
    async readBaseline(): Promise<Baseline | null> {
      const text = await deps.client.readText(deps.lockPath());
      return text === null ? null : (JSON.parse(text) as Baseline);
    },
    async writeRelease(artifacts: ReleaseArtifacts): Promise<void> {
      await deps.client.writeText(
        deps.lockPath(),
        `${JSON.stringify(
          { version: artifacts.version, tokens: artifacts.tokens },
          null,
          2,
        )}\n`,
      );
      const cl = deps.changelog();
      if (cl !== false)
        await writeChangelog(deps.client, cl.changelogPath, artifacts.notes);
    },
  };
}
