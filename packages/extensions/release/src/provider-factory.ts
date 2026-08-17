import type { ReleaseProvider } from 'vertekum';
import type { FileClient } from './fileClient';
import type { GitClient } from './gitClient';
import { createGitReleaseProvider } from './gitReleaseProvider';
import type { GitOptions, LockOptions, ReleaseSettings } from './index';
import { createLockFileReleaseProvider } from './lockFileReleaseProvider';

export interface ReleaseProviderDeps {
  fileClient: FileClient;
  gitClient: GitClient;
  /** Read at call time; provider selection is read once here at construction. */
  config: () => ReleaseSettings;
}

/**
 * Pick the ReleaseProvider from config. Selection is read once at construction (runtime provider
 * swap is deferred); path/toggle options are read at write time via thunks so overrides are honored.
 */
export function createReleaseProvider(
  deps: ReleaseProviderDeps,
): ReleaseProvider {
  const changelog = () => deps.config().changelog;
  if (deps.config().provider === 'git') {
    return createGitReleaseProvider({
      gitClient: deps.gitClient,
      fileClient: deps.fileClient,
      changelog,
      git: () => deps.config().providerOptions as GitOptions,
    });
  }
  return createLockFileReleaseProvider({
    client: deps.fileClient,
    lockPath: () => (deps.config().providerOptions as LockOptions).lockPath,
    changelog,
  });
}
