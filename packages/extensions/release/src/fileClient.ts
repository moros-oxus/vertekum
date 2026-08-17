/** Minimal read/write-text seam over the bridge's /api/file endpoints (ADR-0015). */
export interface FileClient {
  readText(path: string): Promise<string | null>;
  writeText(path: string, content: string): Promise<void>;
}

export function createBridgeFileClient(): FileClient {
  return {
    async readText(path) {
      const res = await fetch(`/api/file?path=${encodeURIComponent(path)}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`read failed: ${res.status}`);
      return res.text();
    },
    async writeText(path, content) {
      const res = await fetch(`/api/file?path=${encodeURIComponent(path)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'text/plain' },
        body: content,
      });
      if (!res.ok) throw new Error(`write failed: ${res.status}`);
    },
  };
}
