import {
  buildReleaseNotes,
  type DtcgNode,
  diffTokens,
  suggestBump,
  type Token,
} from 'vertekum';
import { expect, test, vi } from 'vitest';
import type { FileClient } from './fileClient';
import type { GitClient, GitReleaseAction } from './gitClient';
import { createGitReleaseProvider } from './gitReleaseProvider';

const tok = (id: string, value: unknown): Token => ({
  id,
  path: [id],
  type: 'color',
  value,
});

function fakeFile() {
  const files = new Map<string, string>();
  const client: FileClient = {
    readText: async (p) => files.get(p) ?? null,
    writeText: async (p, c) => void files.set(p, c),
  };
  return { client, files };
}

function fakeGit(overrides: Partial<GitClient> = {}) {
  const release = vi.fn(async (_a: GitReleaseAction) => {});
  const client: GitClient = {
    latestRelease: async () => null,
    collectionAtRef: async () => ({}),
    release,
    ...overrides,
  };
  return { client, release };
}

const notesFor = (prev: Token[], next: Token[], version: string) => {
  const changes = diffTokens(prev, next);
  return buildReleaseNotes(changes, version, suggestBump(changes));
};

test('readBaseline is null when the repo has no version tag', async () => {
  const { client } = fakeFile();
  const { client: git } = fakeGit();
  const p = createGitReleaseProvider({
    gitClient: git,
    fileClient: client,
    changelog: () => ({ changelogPath: 'CHANGELOG.md' }),
    git: () => ({ commit: false, tag: false, bumpPackage: false }),
  });
  expect(await p.readBaseline()).toBeNull();
});

test('readBaseline parses the tag files with parseCollection', async () => {
  const files: Record<string, DtcgNode> = {
    'core.json': { color: { a: { $type: 'color', $value: '#f00' } } },
  };
  const { client: git } = fakeGit({
    latestRelease: async () => ({ tag: 'v1.0.0', version: '1.0.0' }),
    collectionAtRef: async () => files,
  });
  const { client } = fakeFile();
  const p = createGitReleaseProvider({
    gitClient: git,
    fileClient: client,
    changelog: () => ({ changelogPath: 'CHANGELOG.md' }),
    git: () => ({ commit: false, tag: false, bumpPackage: false }),
  });
  const baseline = await p.readBaseline();
  expect(baseline?.version).toBe('1.0.0');
  // parseCollection mints a deterministic id from the path (mintId), so assert the meaningful
  // fields rather than couple the test to the id scheme.
  expect(baseline?.tokens).toHaveLength(1);
  expect(baseline?.tokens[0]).toMatchObject({
    path: ['color', 'a'],
    type: 'color',
    value: '#f00',
  });
});

test('hands-off write writes changelog and makes no git release call', async () => {
  const { client, files } = fakeFile();
  const { client: git, release } = fakeGit();
  const p = createGitReleaseProvider({
    gitClient: git,
    fileClient: client,
    changelog: () => ({ changelogPath: 'CHANGELOG.md' }),
    git: () => ({ commit: false, tag: false, bumpPackage: false }),
  });
  const tokens = [tok('a', '#000')];
  await p.writeRelease({
    version: '0.1.0',
    tokens,
    notes: notesFor([], tokens, '0.1.0'),
  });
  expect(files.get('CHANGELOG.md')).toContain('0.1.0');
  expect(release).not.toHaveBeenCalled();
});

test('tag toggle drives a git release with a default commit message', async () => {
  const { client } = fakeFile();
  const { client: git, release } = fakeGit();
  const p = createGitReleaseProvider({
    gitClient: git,
    fileClient: client,
    changelog: () => ({ changelogPath: 'CHANGELOG.md' }),
    git: () => ({ commit: true, tag: true, bumpPackage: true }),
  });
  const tokens = [tok('a', '#000')];
  await p.writeRelease({
    version: '0.1.0',
    tokens,
    notes: notesFor([], tokens, '0.1.0'),
  });
  expect(release).toHaveBeenCalledWith({
    version: '0.1.0',
    commit: { message: 'Release v0.1.0' },
    tag: true,
    bumpPackage: true,
    changelogPath: 'CHANGELOG.md',
  });
});

test('commit function receives release info and supplies the message', async () => {
  const { client } = fakeFile();
  const { client: git, release } = fakeGit();
  const commit = vi.fn(
    (info: { version: string }) => `chore(tokens): ${info.version}`,
  );
  const p = createGitReleaseProvider({
    gitClient: git,
    fileClient: client,
    changelog: () => false,
    git: () => ({ commit, tag: false, bumpPackage: false }),
  });
  const tokens = [tok('a', '#000')];
  await p.writeRelease({
    version: '2.0.0',
    tokens,
    notes: notesFor([], tokens, '2.0.0'),
  });
  expect(commit).toHaveBeenCalledWith(
    expect.objectContaining({ version: '2.0.0', bump: 'minor' }),
  );
  expect(release).toHaveBeenCalledWith(
    expect.objectContaining({
      commit: { message: 'chore(tokens): 2.0.0' },
      changelogPath: null,
    }),
  );
});
