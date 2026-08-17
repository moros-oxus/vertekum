import { expect, test } from 'vitest';
import { diffTokens } from './diff';
import { buildReleaseNotes, nextVersion } from './notes';

test('nextVersion bumps via semver', () => {
  expect(nextVersion('0.1.0', 'minor')).toBe('0.2.0');
  expect(nextVersion('1.2.3', 'major')).toBe('2.0.0');
  expect(nextVersion('1.2.3', 'patch')).toBe('1.2.4');
});

test('buildReleaseNotes groups changes by kind', () => {
  const changes = diffTokens(
    [{ id: 'x', path: ['x'], type: 'color', value: '#000' }],
    [{ id: 'y', path: ['y'], type: 'color', value: '#111' }],
  );
  const notes = buildReleaseNotes(changes, '0.2.0', 'minor');
  expect(notes.version).toBe('0.2.0');
  expect(notes.bump).toBe('minor');
  expect(notes.groups.removed.map((c) => c.id)).toEqual(['x']);
  expect(notes.groups.added.map((c) => c.id)).toEqual(['y']);
});
