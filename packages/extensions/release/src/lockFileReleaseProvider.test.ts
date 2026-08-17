import type { ReleaseArtifacts, Token } from 'vertekum';
import { buildReleaseNotes, diffTokens, suggestBump } from 'vertekum';
import { expect, test } from 'vitest';
import type { FileClient } from './fileClient';
import { createLockFileReleaseProvider } from './lockFileReleaseProvider';

function fakeClient(seed: Record<string, string> = {}) {
  const files = new Map(Object.entries(seed));
  const client: FileClient = {
    readText: async (p) => files.get(p) ?? null,
    writeText: async (p, c) => void files.set(p, c),
  };
  return { client, files };
}

const tok = (id: string, value: unknown): Token => ({
  id,
  path: [id],
  type: 'color',
  value,
});

function provider(client: FileClient, changelogPath = 'CHANGELOG.md') {
  return createLockFileReleaseProvider({
    client,
    lockPath: () => '.vertekum/release.lock.json',
    changelog: () => ({ changelogPath }),
  });
}

test('readBaseline returns null when no lock exists', async () => {
  const { client } = fakeClient();
  expect(await provider(client).readBaseline()).toBeNull();
});

test('writeRelease then readBaseline round-trips version + tokens', async () => {
  const { client, files } = fakeClient();
  const p = provider(client);
  const tokens = [tok('a', '#000')];
  const changes = diffTokens([], tokens);
  const notes = buildReleaseNotes(changes, '0.1.0', suggestBump(changes));
  const artifacts: ReleaseArtifacts = { version: '0.1.0', tokens, notes };

  await p.writeRelease(artifacts);

  expect(
    JSON.parse(files.get('.vertekum/release.lock.json') as string),
  ).toEqual({ version: '0.1.0', tokens });
  expect(files.get('CHANGELOG.md')).toContain('0.1.0');
  expect(await p.readBaseline()).toEqual({ version: '0.1.0', tokens });
});

test('changelog:false skips the changelog write', async () => {
  const { client, files } = fakeClient();
  const p = createLockFileReleaseProvider({
    client,
    lockPath: () => '.vertekum/release.lock.json',
    changelog: () => false,
  });
  const tokens = [tok('a', '#000')];
  const changes = diffTokens([], tokens);
  await p.writeRelease({
    version: '0.1.0',
    tokens,
    notes: buildReleaseNotes(changes, '0.1.0', suggestBump(changes)),
  });
  expect(files.has('CHANGELOG.md')).toBe(false);
});
