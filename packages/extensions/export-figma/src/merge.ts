import type {
  FigmaCollection,
  FigmaModel,
  FigmaStyle,
  FigmaVariable,
} from './model';
import { MODEL_VERSION } from './model';

/**
 * Merging several compositions into one model — derived from the resolvers, never configured.
 *
 * A second brand's resolver duplicates the structure and differs only in values, so the rule is:
 * a collection gains one mode per composition ONLY where the compositions differ; one that
 * resolves identically everywhere is left exactly as it is. A collection that already has modes
 * takes the (composition, context) pairs that EXIST — a composition without a context contributes
 * no mode for it, and a variable a composition doesn't have simply has no value for its modes.
 * Every absence is a notice; nothing is invented.
 */

export interface BuiltComposition {
  composition: string;
  model: FigmaModel;
}

/** Stable JSON (sorted keys) — the only comparison of "do these compositions differ?". */
function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.keys(value as object)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`,
    )
    .join(',')}}`;
}

/**
 * The comparison form of a collection: an ALIASED mode's concrete value is dropped, because the
 * alias wins in the host and the resolved value behind it is inert. Without this, two compositions
 * whose only difference is what an alias points AT — same edge, different colour behind it — read
 * as different and split a collection that Figma would render identically.
 */
function canonical(collection: FigmaCollection): unknown {
  return {
    modes: collection.modes,
    variables: collection.variables.map((variable) => ({
      name: variable.name,
      type: variable.type,
      alias: variable.alias ?? {},
      values: Object.fromEntries(
        Object.entries(variable.valuesByMode).filter(
          ([mode]) => variable.alias?.[mode] === undefined,
        ),
      ),
    })),
  };
}

/** A single-mode set collection carries the mode name `default`, which never reaches a merged name. */
function isSingleMode(collection: FigmaCollection): boolean {
  return collection.modes.length === 1 && collection.modes[0] === 'default';
}

function listed(names: string[]): string {
  return names.length <= 5
    ? names.join(', ')
    : `${names.slice(0, 5).join(', ')} +${names.length - 5} more`;
}

interface Part {
  composition: string;
  collection: FigmaCollection;
}

function mergeCollection(
  name: string,
  parts: Part[],
  notices: string[],
): FigmaCollection {
  const modes: string[] = [];
  const modeSources: FigmaCollection['modeSources'] = {};
  const modeMap = new Map<string, Map<string, string>>();

  for (const { composition, collection } of parts) {
    const single = isSingleMode(collection);
    const map = new Map<string, string>();
    for (const mode of collection.modes) {
      const merged = single ? composition : `${composition}/${mode}`;
      modes.push(merged);
      modeSources[merged] = single
        ? { composition }
        : { composition, context: mode };
      map.set(mode, merged);
    }
    modeMap.set(composition, map);
  }

  // Contexts one composition has and another lacks: no mode is emitted for the pair.
  const contexts = new Set(
    parts.flatMap(({ collection }) =>
      isSingleMode(collection) ? [] : collection.modes,
    ),
  );
  for (const { composition, collection } of parts) {
    if (isSingleMode(collection)) continue;
    for (const context of contexts) {
      if (!collection.modes.includes(context)) {
        notices.push(
          `'${composition}' has no '${name}' context '${context}' — no mode emitted for it`,
        );
      }
    }
  }

  const order: string[] = [];
  const byName = new Map<string, FigmaVariable>();
  for (const { composition, collection } of parts) {
    const map = modeMap.get(composition);
    if (!map) continue;
    for (const variable of collection.variables) {
      let merged = byName.get(variable.name);
      if (!merged) {
        order.push(variable.name);
        merged = {
          name: variable.name,
          type: variable.type,
          valuesByMode: {},
          ...(variable.source ? { source: variable.source } : {}),
          scopes: variable.scopes,
          codeSyntax: variable.codeSyntax,
        };
        byName.set(variable.name, merged);
      } else if (merged.type !== variable.type) {
        notices.push(
          `'${variable.name}' is ${merged.type} elsewhere and ${variable.type} in '${composition}' — kept ${merged.type}`,
        );
      }
      for (const [mode, value] of Object.entries(variable.valuesByMode)) {
        const to = map.get(mode);
        if (to !== undefined) merged.valuesByMode[to] = value;
      }
      for (const [mode, alias] of Object.entries(variable.alias ?? {})) {
        const to = map.get(mode);
        if (to !== undefined) merged.alias = { ...merged.alias, [to]: alias };
      }
    }
  }

  // Variables a composition doesn't have: its modes stay empty, said once per composition.
  for (const { composition, collection } of parts) {
    const has = new Set(collection.variables.map((v) => v.name));
    const missing = order.filter((varName) => !has.has(varName));
    if (missing.length > 0) {
      notices.push(
        `collection '${name}': ${missing.length} variable(s) have no value in '${composition}' (${listed(missing)})`,
      );
    }
  }

  return {
    name,
    modes,
    variables: order.map((varName) => byName.get(varName) as FigmaVariable),
    modeSources,
  };
}

function mergeStyles(
  built: BuiltComposition[],
  notices: string[],
): FigmaStyle[] {
  const keys: string[] = [];
  const parts = new Map<
    string,
    Array<{ composition: string; style: FigmaStyle }>
  >();
  for (const { composition, model } of built) {
    for (const style of model.styles) {
      const key = `${style.kind}:${style.name}`;
      if (!parts.has(key)) {
        keys.push(key);
        parts.set(key, []);
      }
      parts.get(key)?.push({ composition, style });
    }
  }

  const out: FigmaStyle[] = [];
  for (const key of keys) {
    const found = parts.get(key) ?? [];
    const [first] = found;
    if (!first) continue;
    const identical = found.every(
      (entry) => stable(entry.style) === stable(first.style),
    );
    if (identical) {
      out.push(first.style);
      continue;
    }
    // A Figma style has no modes, so a style that differs cannot be merged: emit one per
    // composition, named for it, rather than silently picking a winner.
    notices.push(
      `style '${first.style.name}' differs between compositions — emitted one per composition`,
    );
    for (const { composition, style } of found) {
      out.push({ ...style, name: `${composition}/${style.name}` });
    }
  }
  return out;
}

/**
 * Merge per-composition models into the artifact. One composition in, one model out (the
 * single-composition path stamps identity and nothing else).
 */
export function mergeModels(
  built: BuiltComposition[],
  target?: string,
): FigmaModel {
  const notices: string[] = [];
  const multi = built.length > 1;
  for (const { composition, model } of built) {
    for (const notice of model.source.notices) {
      notices.push(multi ? `[${composition}] ${notice}` : notice);
    }
  }

  const [head] = built;
  const model: FigmaModel = {
    version: MODEL_VERSION,
    source: {
      ...(target === undefined ? {} : { target }),
      compositions: built.map((entry) => entry.composition).filter(Boolean),
      generator: head?.model.source.generator ?? '',
      notices,
    },
    collections: [],
    styles: [],
  };
  if (!head) return model;
  if (!multi) {
    model.collections = head.model.collections;
    model.styles = head.model.styles;
    return model;
  }

  const names: string[] = [];
  for (const { model: each } of built) {
    for (const collection of each.collections) {
      if (!names.includes(collection.name)) names.push(collection.name);
    }
  }

  for (const name of names) {
    const parts: Part[] = [];
    for (const { composition, model: each } of built) {
      const collection = each.collections.find((c) => c.name === name);
      if (collection) parts.push({ composition, collection });
    }
    const [first] = parts;
    if (!first) continue;
    if (parts.length === 1) {
      notices.push(
        `collection '${name}' comes only from '${first.composition}' — no composition modes`,
      );
      model.collections.push(first.collection);
      continue;
    }
    const identical = parts.every(
      (part) =>
        stable(canonical(part.collection)) ===
        stable(canonical(first.collection)),
    );
    // The whole point: identical collections are left exactly as they are.
    model.collections.push(
      identical ? first.collection : mergeCollection(name, parts, notices),
    );
  }

  model.styles = mergeStyles(built, notices);
  return model;
}
