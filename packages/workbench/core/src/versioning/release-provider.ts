import type { Token } from '../document/types';
import type { ReleaseNotes } from './notes';

export interface Baseline {
  tokens: Token[];
  version: string;
}

export interface ReleaseArtifacts {
  version: string;
  tokens: Token[];
  notes: ReleaseNotes;
}

/**
 * The swappable edges of versioning (ADR-0008 style): one pure engine, many providers. The MVP
 * ships a lock-file provider; git and hosted providers implement the same interface later. The
 * `announce` edge (git push / webhook / publish) is intentionally deferred.
 */
export interface ReleaseProvider {
  /** The previous released state; null = no prior release (first release). */
  readBaseline(): Promise<Baseline | null>;
  /** Persist the new release (snapshot + version + changelog). */
  writeRelease(artifacts: ReleaseArtifacts): Promise<void>;
}
