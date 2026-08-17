import { expect, test, vi } from 'vitest';
import type { FileClient } from './fileClient';
import type { GitClient } from './gitClient';
import type { ReleaseSettings } from './index';
import { createReleaseProvider } from './provider-factory';

const noopFile: FileClient = {
  readText: async () => null,
  writeText: async () => {},
};

test('selects the git provider and reads baseline from tags', async () => {
  const gitClient: GitClient = {
    latestRelease: vi.fn(async () => ({ tag: 'v1.0.0', version: '1.0.0' })),
    collectionAtRef: async () => ({}),
    release: async () => {},
  };
  const config = () =>
    ({
      changelog: { changelogPath: 'CHANGELOG.md' },
      provider: 'git',
      providerOptions: { commit: false, tag: false, bumpPackage: false },
    }) as ReleaseSettings;
  const p = createReleaseProvider({ fileClient: noopFile, gitClient, config });
  await p.readBaseline();
  expect(gitClient.latestRelease).toHaveBeenCalled();
});

test('selects the lock provider and reads baseline from the lock file', async () => {
  const readText = vi.fn(async () => null);
  const fileClient: FileClient = { readText, writeText: async () => {} };
  const gitClient: GitClient = {
    latestRelease: vi.fn(async () => null),
    collectionAtRef: async () => ({}),
    release: async () => {},
  };
  const config = () =>
    ({
      changelog: { changelogPath: 'CHANGELOG.md' },
      provider: 'lock',
      providerOptions: { lockPath: '.vertekum/release.lock.json' },
    }) as ReleaseSettings;
  const p = createReleaseProvider({ fileClient, gitClient, config });
  await p.readBaseline();
  expect(readText).toHaveBeenCalledWith('.vertekum/release.lock.json');
  expect(gitClient.latestRelease).not.toHaveBeenCalled();
});
