import type { DtcgNode } from 'vertekum';

export interface GitRelease {
  tag: string;
  version: string;
}

export interface GitReleaseAction {
  version: string;
  commit: false | { message: string };
  tag: boolean;
  bumpPackage: boolean;
  changelogPath: string | null;
}

/** Browser-side seam over the bridge's /api/git/* endpoints (sibling of FileClient). */
export interface GitClient {
  latestRelease(): Promise<GitRelease | null>;
  collectionAtRef(ref: string): Promise<Record<string, DtcgNode>>;
  release(action: GitReleaseAction): Promise<void>;
}

export function createBridgeGitClient(): GitClient {
  return {
    async latestRelease() {
      const res = await fetch('/api/git/latest-release');
      if (!res.ok) throw new Error(`latest-release failed: ${res.status}`);
      return ((await res.json()) as { release: GitRelease | null }).release;
    },
    async collectionAtRef(ref) {
      const res = await fetch(
        `/api/git/collection?ref=${encodeURIComponent(ref)}`,
      );
      if (!res.ok) throw new Error(`git collection failed: ${res.status}`);
      return ((await res.json()) as { files: Record<string, DtcgNode> }).files;
    },
    async release(action) {
      const res = await fetch('/api/git/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
      });
      if (!res.ok) throw new Error(`git release failed: ${res.status}`);
    },
  };
}
