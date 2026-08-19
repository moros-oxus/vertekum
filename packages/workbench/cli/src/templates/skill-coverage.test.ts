import { expect, test } from 'vitest';
import { RELEASE_SKILL_TEMPLATE, SKILL_STAMP, SKILL_TEMPLATE } from './index';

/**
 * Drift guard: the skills teach the CONTRACT, so every capability family the CLI exposes must at
 * least be named in them. When a new verb family or command ships, this list grows with it —
 * a failure here means the skill has rotted, not that this test is wrong.
 *
 * The verb-family names mirror `@vertekum/core`'s registered verbs
 * (`core/src/verbs/{token,group,set}-verbs.ts`) and the cli's own commands (`cli.ts`).
 */
const TOKENS_SKILL_MUST_MENTION = [
  // orientation + the loop
  'describe',
  'check',
  'build',
  // verb families
  'token add',
  'token set',
  'token remove',
  'token move',
  'token rename',
  'group add',
  'group set',
  'group remove',
  'set add',
  'set remove',
  '--allow-group',
  '--dry-run',
  '--json',
  // schemas / vocabulary
  'schema eject',
  // value notation
  'migrate values',
  'colorSpace',
];

test('the tokens skill names every capability family', () => {
  for (const term of TOKENS_SKILL_MUST_MENTION) {
    expect(SKILL_TEMPLATE, `tokens skill must mention "${term}"`).toContain(
      term,
    );
  }
});

test('the tokens skill states the exit-code contract', () => {
  expect(SKILL_TEMPLATE).toContain('`0`');
  expect(SKILL_TEMPLATE).toContain('`1`');
  expect(SKILL_TEMPLATE).toContain('`2`');
});

test('the release skill carries the severity vocabulary and the package seam', () => {
  // Mirrors core/src/versioning/diff.ts.
  for (const term of ['major', 'minor', 'patch', 'renamed', 'removed']) {
    expect(RELEASE_SKILL_TEMPLATE).toContain(term);
  }
  expect(RELEASE_SKILL_TEMPLATE).toContain('package');
});

test('both skills carry the generated stamp', () => {
  expect(SKILL_TEMPLATE).toContain(SKILL_STAMP);
  expect(RELEASE_SKILL_TEMPLATE).toContain(SKILL_STAMP);
});
