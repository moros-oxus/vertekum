import type { ResolverDocument } from 'vertekum';

export interface ContextEntry {
  name: string;
  sources: string[]; // `$ref` strings, e.g. 'core.json'
}
export type Entry =
  | { kind: 'set'; name: string; description?: string; sources: string[] }
  | {
      kind: 'modifier';
      name: string;
      description?: string;
      contexts: ContextEntry[];
      default?: string;
    };

const SET_REF = /^#\/sets\/(.+)$/;
const MODIFIER_REF = /^#\/modifiers\/(.+)$/;

/** `$ref` strings of a resolver `sources` array (only `$ref` sources are surfaced). */
function refStrings(sources: unknown): string[] {
  if (!Array.isArray(sources)) return [];
  return sources
    .map((s) => (s as { $ref?: unknown }).$ref)
    .filter((r): r is string => typeof r === 'string');
}

/** Walk `resolutionOrder` → an ordered list of editor entries (dangling refs dropped). */
export function toEntries(doc: ResolverDocument): Entry[] {
  const entries: Entry[] = [];
  for (const { $ref } of doc.resolutionOrder) {
    const setName = SET_REF.exec($ref)?.[1];
    if (setName !== undefined) {
      const set = doc.sets[setName];
      if (!set) continue;
      entries.push({
        kind: 'set',
        name: setName,
        ...(set.description !== undefined
          ? { description: set.description }
          : {}),
        sources: refStrings(set.sources),
      });
      continue;
    }
    const modName = MODIFIER_REF.exec($ref)?.[1];
    if (modName !== undefined) {
      const mod = doc.modifiers[modName];
      if (!mod) continue;
      entries.push({
        kind: 'modifier',
        name: modName,
        ...(mod.description !== undefined
          ? { description: mod.description }
          : {}),
        contexts: Object.entries(mod.contexts).map(([name, sources]) => ({
          name,
          sources: refStrings(sources),
        })),
        ...(mod.default !== undefined ? { default: mod.default } : {}),
      });
    }
  }
  return entries;
}

/** Rebuild a ResolverDocument from entries (list order = resolutionOrder), carrying `base`'s meta. */
export function fromEntries(
  entries: Entry[],
  base: ResolverDocument,
): ResolverDocument {
  const sets: ResolverDocument['sets'] = {};
  const modifiers: ResolverDocument['modifiers'] = {};
  const resolutionOrder: Array<{ $ref: string }> = [];
  for (const entry of entries) {
    if (entry.kind === 'set') {
      sets[entry.name] = {
        ...(entry.description !== undefined
          ? { description: entry.description }
          : {}),
        sources: entry.sources.map(($ref) => ({ $ref })),
      };
      resolutionOrder.push({ $ref: `#/sets/${entry.name}` });
    } else {
      modifiers[entry.name] = {
        ...(entry.description !== undefined
          ? { description: entry.description }
          : {}),
        contexts: Object.fromEntries(
          entry.contexts.map((c) => [
            c.name,
            c.sources.map(($ref) => ({ $ref })),
          ]),
        ),
        ...(entry.default !== undefined ? { default: entry.default } : {}),
      };
      resolutionOrder.push({ $ref: `#/modifiers/${entry.name}` });
    }
  }
  const next: ResolverDocument = {
    version: base.version,
    sets,
    modifiers,
    resolutionOrder,
  };
  if (base.name !== undefined) next.name = base.name;
  if (base.description !== undefined) next.description = base.description;
  if (base.$schema !== undefined) next.$schema = base.$schema;
  if (base.$defs !== undefined) next.$defs = base.$defs;
  if (base.$extensions !== undefined) next.$extensions = base.$extensions;
  return next;
}
