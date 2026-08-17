import {
  buildReleaseNotes,
  diffTokens,
  suggestBump,
  type Token,
} from 'vertekum';
import { expect, test } from 'vitest';
import { writeChangelog } from './changelog';
import type { FileClient } from './fileClient';

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

test('writeChangelog creates a section for the release version', async () => {
  const { client, files } = fakeClient();
  const tokens = [tok('a', '#000')];
  const changes = diffTokens([], tokens);
  const notes = buildReleaseNotes(changes, '1.0.0', suggestBump(changes));
  await writeChangelog(client, 'CHANGELOG.md', notes);
  expect(files.get('CHANGELOG.md')).toContain('1.0.0');
  expect(files.get('CHANGELOG.md')).toContain('a');
});
