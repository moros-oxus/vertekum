import type { Token } from '../document/types';

export type Severity = 'major' | 'minor' | 'patch';

export type ChangeKind =
  | 'added'
  | 'removed'
  | 'renamed'
  | 'retyped'
  | 'changed'
  | 'deprecated';

export interface TokenChange {
  kind: ChangeKind;
  id: string;
  /** Current path (baseline path for 'removed'). */
  path: string[];
  fromPath?: string[]; // 'renamed'
  fromType?: string; // 'retyped'
  /** 'changed': which fields moved; `deprecation` (present when true) — un-deprecated or re-worded. */
  fields?: { value: boolean; description: boolean; deprecation?: boolean };
  /** 'deprecated': the token's reason, or `true` when none was given. */
  deprecated?: true | string;
}

const SEVERITY: Record<ChangeKind, Severity> = {
  removed: 'major',
  renamed: 'major',
  retyped: 'major',
  added: 'minor',
  changed: 'patch',
  // Announcing a removal is not one: the token still exists and still works.
  deprecated: 'patch',
};

const RANK: Record<Severity, number> = { major: 3, minor: 2, patch: 1 };

/** Stable JSON compare — token values are DTCG-JSON, so this is a safe structural equality. */
function eq(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/**
 * Semantic diff of two normalized token sets, keyed on stable `id` (ADR-0005) — this is what tells
 * a rename apart from a remove+add. Pure and order-independent.
 */
export function diffTokens(baseline: Token[], current: Token[]): TokenChange[] {
  const base = new Map(baseline.map((t) => [t.id, t]));
  const cur = new Map(current.map((t) => [t.id, t]));
  const changes: TokenChange[] = [];

  for (const [id, b] of base) {
    if (!cur.has(id)) changes.push({ kind: 'removed', id, path: b.path });
  }
  for (const [id, c] of cur) {
    const b = base.get(id);
    if (!b) {
      changes.push({ kind: 'added', id, path: c.path });
      continue;
    }
    if (b.type !== c.type) {
      changes.push({ kind: 'retyped', id, path: c.path, fromType: b.type });
      continue;
    }
    if (b.path.join(' ') !== c.path.join(' ')) {
      changes.push({ kind: 'renamed', id, path: c.path, fromPath: b.path });
      continue;
    }
    // Newly deprecated: its own change, announced in its own changelog section. Any other move of
    // the deprecation — lifted, or re-worded — is an ordinary change of the token.
    const newlyDeprecated =
      b.deprecated === undefined && c.deprecated !== undefined;
    if (newlyDeprecated) {
      changes.push({
        kind: 'deprecated',
        id,
        path: c.path,
        deprecated: c.deprecated,
      });
    }
    const deprecation = !newlyDeprecated && !eq(b.deprecated, c.deprecated);
    const fields = {
      value: !eq(b.value, c.value),
      description: (b.description ?? '') !== (c.description ?? ''),
      ...(deprecation ? { deprecation } : {}),
    };
    if (fields.value || fields.description || deprecation) {
      changes.push({ kind: 'changed', id, path: c.path, fields });
    }
  }
  return changes;
}

/** Highest-severity bump implied by the changes; null when there are none. */
export function suggestBump(changes: TokenChange[]): Severity | null {
  let best: Severity | null = null;
  for (const ch of changes) {
    const s = SEVERITY[ch.kind];
    if (best === null || RANK[s] > RANK[best]) best = s;
  }
  return best;
}
