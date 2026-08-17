import { Changelog, parser, Release } from 'keep-a-changelog';
import type { ReleaseNotes, TokenChange } from 'vertekum';
import type { FileClient } from './fileClient';

/** Human-facing changelog line for a change, e.g. `color.brand` or `color.old → color.new`. */
function line(c: TokenChange): string {
  const path = c.path.join('.');
  if (c.kind === 'renamed' && c.fromPath)
    return `${c.fromPath.join('.')} → ${path}`;
  if (c.kind === 'retyped' && c.fromType) return `${path} (was ${c.fromType})`;
  return path;
}

/** Add a release section to CHANGELOG markdown (creating it if absent) via keep-a-changelog. */
function renderChangelog(
  md: string | null,
  notes: ReleaseNotes,
  date: string,
): string {
  const changelog = md ? parser(md) : new Changelog('Changelog');
  const release = new Release(notes.version, date);
  for (const c of notes.groups.added) release.added(line(c));
  for (const c of [
    ...notes.groups.changed,
    ...notes.groups.renamed,
    ...notes.groups.retyped,
  ]) {
    release.changed(line(c));
  }
  for (const c of notes.groups.removed) release.removed(line(c));
  changelog.addRelease(release);
  return changelog.toString();
}

/**
 * The shared changelog action: read the changelog (if any), append the release section, write it
 * back. Provider-agnostic — both the lock and git providers call this when `changelog` is enabled.
 */
export async function writeChangelog(
  client: FileClient,
  changelogPath: string,
  notes: ReleaseNotes,
): Promise<void> {
  const existing = await client.readText(changelogPath);
  const date = new Date().toISOString().slice(0, 10);
  await client.writeText(changelogPath, renderChangelog(existing, notes, date));
}
