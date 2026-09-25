import { tokenId } from '../document/identity';
import type { Token } from '../document/types';
import { type DtcgNode, exportPath } from '../dtcg/parse';
import type { ExporterInput, ResolvedComposition } from './exporter';

/**
 * Lowering: a custom type expressed in standard DTCG types, declared ONCE by the type's owner and
 * applied before every exporter (ADR-0013, amended — the resolve stage is resolve + prepare). An
 * exporter then only ever sees standard types and needs to know nothing about a project's own.
 *
 * A lowering turns one token into a GROUP of standard-typed children (`spacial` → `top`/`right`/
 * `bottom`/`left` dimensions). References stay references, so a target that keeps aliases keeps
 * them. A PRESENTATION (the `build` chain, per exporter) takes precedence where an extension offers
 * one — whether to offer it is the extension author's choice; the lowering is the guaranteed
 * fallback.
 */
export interface TypeLowering {
  /** The custom `$type` this lowering expresses. One owner per type. */
  type: string;
  /**
   * The token as standard-typed children, keyed by child name; `null` when this value cannot be
   * lowered (the token then passes through as authored, and the exporter reports it).
   */
  lower(
    token: Token,
  ): Record<
    string,
    { type: string; value: unknown; description?: string }
  > | null;
}

export interface TypeLoweringService {
  register(lowering: TypeLowering): void;
  get(type: string): TypeLowering | undefined;
  list(): TypeLowering[];
}

export const TYPE_LOWERING_SERVICE = 'type-lowering';

/** The kernel seeds one registry before extensions activate, like the codec and exporter ones. */
export function createTypeLoweringRegistry(): TypeLoweringService {
  const byType = new Map<string, TypeLowering>();
  return {
    register(lowering) {
      if (byType.has(lowering.type)) {
        throw new Error(
          `a lowering for type '${lowering.type}' is already registered — one extension owns a type`,
        );
      }
      byType.set(lowering.type, lowering);
    },
    get(type) {
      return byType.get(type);
    },
    list() {
      return [...byType.values()];
    },
  };
}

/** One token's children, or `undefined` when no lowering applies. */
function childrenOf(
  token: Token,
  lowerings: TypeLoweringService,
): ReturnType<TypeLowering['lower']> | undefined {
  const lowering = lowerings.get(token.type);
  if (!lowering) return undefined;
  return lowering.lower(token) ?? undefined;
}

/** A resolved bundle with every lowerable token replaced by its standard-typed children. */
export function lowerTokens(
  tokens: Token[],
  lowerings: TypeLoweringService,
): Token[] {
  if (lowerings.list().length === 0) return tokens;
  const existing = new Set(tokens.map((t) => t.path.join('.')));
  const out: Token[] = [];
  for (const token of tokens) {
    const children = childrenOf(token, lowerings);
    if (!children) {
      out.push(token);
      continue;
    }
    const set = token.set ?? 'tokens';
    // A group's own value (`$root`) lowers INTO the group: `squish.$root` → `squish.top`, never
    // `squish.$root.top` — `$root` is a leaf name. A real child of the same name wins.
    const at = exportPath(token.path);
    for (const [name, child] of Object.entries(children)) {
      const path = [...at, name];
      if (at !== token.path && existing.has(path.join('.'))) continue;
      out.push({
        id: tokenId(set, path),
        path,
        type: child.type,
        value: child.value,
        set,
        ...(child.description !== undefined
          ? { description: child.description }
          : {}),
      });
    }
  }
  return out;
}

/** The staged node a lowered token becomes: a group of standard-typed children. */
export function loweredNode(
  token: Token,
  lowerings: TypeLoweringService,
): DtcgNode | undefined {
  const children = childrenOf(token, lowerings);
  if (!children) return undefined;
  return Object.fromEntries(
    Object.entries(children).map(([name, child]) => [
      name,
      {
        $type: child.type,
        $value: child.value,
        ...(child.description !== undefined
          ? { $description: child.description }
          : {}),
      },
    ]),
  ) as DtcgNode;
}

/** Every bundle an exporter receives, lowered — base, variants, raw tokens and each composition. */
export function lowerInput(
  input: ExporterInput,
  lowerings: TypeLoweringService,
): ExporterInput {
  if (lowerings.list().length === 0) return input;
  const lowerComposition = (c: ResolvedComposition): ResolvedComposition => ({
    ...c,
    base: lowerTokens(c.base, lowerings),
    variants: c.variants.map((v) => ({
      ...v,
      tokens: lowerTokens(v.tokens, lowerings),
    })),
  });
  return {
    ...input,
    base: lowerTokens(input.base, lowerings),
    variants: input.variants.map((v) => ({
      ...v,
      tokens: lowerTokens(v.tokens, lowerings),
    })),
    tokens: lowerTokens(input.tokens, lowerings),
    ...(input.compositions
      ? { compositions: input.compositions.map(lowerComposition) }
      : {}),
  };
}
