import { expect, test } from 'vitest';
import { ReleaseSettings } from './index';

test('empty config yields lock defaults', () => {
  const s = ReleaseSettings.parse({});
  expect(s.provider).toBe('lock');
  expect(s.changelog).toEqual({ changelogPath: '.vertekum/CHANGELOG.md' });
  expect(s.providerOptions).toEqual({
    lockPath: '.vertekum/release.lock.json',
  });
});

test('git provider yields git option defaults', () => {
  const s = ReleaseSettings.parse({ provider: 'git' });
  expect(s.providerOptions).toEqual({
    commit: false,
    tag: false,
    bumpPackage: false,
  });
});

test('git commit accepts a message-builder function', () => {
  const commit = (info: { version: string }) => `release ${info.version}`;
  const s = ReleaseSettings.parse({
    provider: 'git',
    providerOptions: { commit },
  });
  const opts = s.providerOptions as unknown as {
    commit: (i: { version: string }) => string;
  };
  expect(opts.commit({ version: '1.2.0' })).toBe('release 1.2.0');
});

test('changelog can be disabled', () => {
  const s = ReleaseSettings.parse({ changelog: false });
  expect(s.changelog).toBe(false);
});

test('lock provider keeps a custom lockPath', () => {
  const s = ReleaseSettings.parse({
    provider: 'lock',
    providerOptions: { lockPath: 'db/tokens.lock.json' },
  });
  expect(s.providerOptions).toEqual({ lockPath: 'db/tokens.lock.json' });
});
