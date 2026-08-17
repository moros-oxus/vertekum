import semver from 'semver';
import type { Severity, TokenChange } from './diff';

export interface ReleaseNotes {
  bump: Severity | null;
  version: string;
  groups: {
    added: TokenChange[];
    changed: TokenChange[];
    removed: TokenChange[];
    renamed: TokenChange[];
    retyped: TokenChange[];
  };
}

/** Next semver string from a current version + bump. Throws on an unparseable current version. */
export function nextVersion(current: string, bump: Severity): string {
  const next = semver.inc(current, bump);
  if (next === null) throw new Error(`invalid version: ${current}`);
  return next;
}

/** Group changes by kind for a changelog (rendering is a provider concern, not core). */
export function buildReleaseNotes(
  changes: TokenChange[],
  version: string,
  bump: Severity | null,
): ReleaseNotes {
  const groups: ReleaseNotes['groups'] = {
    added: [],
    changed: [],
    removed: [],
    renamed: [],
    retyped: [],
  };
  for (const ch of changes) groups[ch.kind].push(ch);
  return { bump, version, groups };
}
