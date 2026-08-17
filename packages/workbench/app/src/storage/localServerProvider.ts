import type { DtcgNode, FileStore } from '@vertekum/core';

/**
 * Browser-side FileStore backed by the local bridge server over its HTTP API
 * (ADR-0015). Same-origin via the Vite proxy, so no CORS in dev.
 */
export function createLocalServerFileStore(baseUrl = '/api'): FileStore {
  return {
    async readAll() {
      const res = await fetch(`${baseUrl}/collection`);
      if (!res.ok) throw new Error(`load failed: ${res.status}`);
      const body = (await res.json()) as { files: Record<string, DtcgNode> };
      return body.files;
    },
    async writeAll(files) {
      const res = await fetch(`${baseUrl}/collection`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
      });
      if (!res.ok) throw new Error(`save failed: ${res.status}`);
    },
  };
}
