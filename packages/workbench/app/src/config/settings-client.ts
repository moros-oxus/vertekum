type Overrides = Record<string, Record<string, unknown>>;

export interface SettingsClient {
  load(): Promise<Overrides>;
  save(all: Overrides): Promise<void>;
}

/** Bridge client for tier-3 user overrides persisted at .vertekum/settings.json (ADR-0015). */
export function createSettingsClient(baseUrl = '/api'): SettingsClient {
  return {
    async load() {
      const res = await fetch(`${baseUrl}/settings`);
      if (!res.ok) throw new Error(`settings load failed: ${res.status}`);
      const body = (await res.json()) as { settings: Overrides };
      return body.settings ?? {};
    },
    async save(all) {
      const res = await fetch(`${baseUrl}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: all }),
      });
      if (!res.ok) throw new Error(`settings save failed: ${res.status}`);
    },
  };
}
