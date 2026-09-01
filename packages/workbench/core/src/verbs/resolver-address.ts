import type { Document } from '../document/document';

/**
 * The address a `vtk resolver` verb operates on — the flag names which BRANCH of the resolver
 * document the `/`-joined path walks:
 *
 *   (no flag)  <resolver>                           the resolver itself
 *   -s         [<resolver>/]<set>                   a set entry
 *   -m         [<resolver>/]<modifier>[/<context>]  a modifier, or a context under it
 *
 * The leading `<resolver>/` may be elided when the project has exactly one resolver. A first
 * segment naming an existing resolver is ALWAYS read as the resolver — deterministic over
 * guessing, so a modifier sharing a resolver's name is reachable only by full path.
 */
export interface ResolverAddress {
  resolver: string;
  branch: 'resolver' | 'set' | 'modifier';
  set?: string;
  modifier?: string;
  context?: string;
}

/** Levenshtein distance, for near-miss suggestions. Inputs are short names; O(n·m) is nothing. */
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const row = [i];
    for (let j = 1; j <= n; j++) {
      row[j] = Math.min(
        (prev[j] as number) + 1,
        (row[j - 1] as number) + 1,
        (prev[j - 1] as number) + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = row;
  }
  return prev[n] as number;
}

/** The nearest existing name within two edits, or undefined. `0` never matches — that name exists. */
export function closest(
  name: string,
  candidates: Iterable<string>,
): string | undefined {
  let best: string | undefined;
  let bestDistance = 3;
  for (const candidate of candidates) {
    const distance = editDistance(name, candidate);
    if (distance > 0 && distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best;
}

/** ` — did you mean 'x'?` when a near-miss exists, else nothing. Appended to unknown-name refusals. */
export function suggest(name: string, candidates: Iterable<string>): string {
  const near = closest(name, candidates);
  return near ? ` — did you mean '${near}'?` : '';
}

function segmentsOf(path: string, shape: string): string[] {
  const segments = path.split('/');
  if (segments.some((segment) => segment === '')) {
    throw new Error(`'${path}' has an empty path segment — expected ${shape}`);
  }
  return segments;
}

/**
 * Resolve the leading resolver of a flag path. `segments.length === maxDepth` means the path is
 * full, so its first segment MUST name a resolver; shorter paths elide it, which only one (or an
 * explicitly named first segment) can satisfy.
 */
function takeResolver(
  segments: string[],
  maxDepth: number,
  shape: string,
  names: string[],
): { resolver: string; rest: string[] } {
  if (segments.length > maxDepth) {
    throw new Error(`'${segments.join('/')}' is too deep — expected ${shape}`);
  }
  if (segments.length >= 2 && names.includes(segments[0] as string)) {
    return { resolver: segments[0] as string, rest: segments.slice(1) };
  }
  if (segments.length === maxDepth) {
    throw new Error(
      `no resolver '${segments[0]}'${suggest(segments[0] as string, names)}`,
    );
  }
  if (names.length === 1)
    return { resolver: names[0] as string, rest: segments };
  if (names.length === 0) {
    throw new Error('no resolvers exist — create one: vtk resolver add <name>');
  }
  throw new Error(
    `several resolvers exist — lead the path with one of: ${names.join(', ')}`,
  );
}

/**
 * Parse a verb's address from its `-s`/`-m` option values and (for the no-flag form) its bare
 * positional. Returns null when nothing addresses anything — `list` treats that as "everything";
 * every other verb refuses. The bare form's resolver existence is NOT checked here: `add` is the
 * one verb that wants a name that does not exist yet.
 */
export function resolverAddress(
  document: Document,
  input: { set?: unknown; modifier?: unknown; bare?: string },
): ResolverAddress | null {
  const setPath = typeof input.set === 'string' ? input.set : undefined;
  const modifierPath =
    typeof input.modifier === 'string' ? input.modifier : undefined;
  if (setPath !== undefined && modifierPath !== undefined) {
    throw new Error('pass either -s or -m, not both — one address per command');
  }
  const names = [...document.getResolvers().keys()];

  if (setPath !== undefined) {
    const shape = '[resolver/]set (the set may be a nested path)';
    const segments = segmentsOf(setPath, shape);
    if (segments.length === 1 && names.includes(segments[0] as string)) {
      throw new Error(`'${setPath}' names only a resolver — expected ${shape}`);
    }
    // The set name may itself be a path (`brands/brand-b` — nested collection files), so only the
    // FIRST segment is ever a resolver candidate; the rest re-joins as the set name.
    const { resolver, rest } = takeResolver(
      segments,
      Number.POSITIVE_INFINITY,
      shape,
      names,
    );
    return { resolver, branch: 'set', set: rest.join('/') };
  }

  if (modifierPath !== undefined) {
    const shape = '[resolver/]modifier[/context]';
    const segments = segmentsOf(modifierPath, shape);
    if (segments.length === 1 && names.includes(segments[0] as string)) {
      throw new Error(
        `'${modifierPath}' names only a resolver — expected ${shape}`,
      );
    }
    const { resolver, rest } = takeResolver(segments, 3, shape, names);
    return {
      resolver,
      branch: 'modifier',
      modifier: rest[0],
      context: rest[1],
    };
  }

  if (input.bare !== undefined) {
    return { resolver: input.bare, branch: 'resolver' };
  }
  return null;
}
