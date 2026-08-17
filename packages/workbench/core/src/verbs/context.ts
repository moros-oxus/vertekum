import type { Document } from '../document/document';
import { setFileName } from '../document/files';
import type { Token } from '../document/types';
import type { DtcgNode } from '../dtcg/parse';
import type { CommandContext } from '../shell/types';

/**
 * `CommandContext.project` is typed `unknown` because core does not depend on the CLI's `Project`
 * (ADR-0030 amendment). Every verb needs the document out of it, so the narrowing lives here once.
 */
export function documentOf(ctx: CommandContext): Document {
  const project = ctx.project as { document?: Document } | undefined;
  if (!project?.document) {
    throw new Error('no project document — this verb needs a loaded project');
  }
  return project.document;
}

/**
 * A required positional argument. `CommandContext.args` is an open record, so every read is
 * `string | undefined` — but the CLI framework has already enforced arity by the time a handler
 * runs. This makes that guarantee explicit instead of asserting it away, and gives a real message
 * to any driver that calls a verb directly.
 */
export function requireArg(ctx: CommandContext, name: string): string {
  const value = ctx.args[name];
  if (value === undefined)
    throw new Error(`missing required argument: ${name}`);
  return value;
}

/** The token at a dotted path, or undefined. Paths are unique, so at most one matches. */
export function tokenAtPath(
  document: Document,
  path: string,
): Token | undefined {
  return document.getAllTokens().find((t) => t.path.join('.') === path);
}

/** True when any token sits beneath `path` — i.e. the path names a group rather than a token. */
export function isGroupPath(document: Document, path: string): boolean {
  const prefix = `${path}.`;
  return document
    .getAllTokens()
    .some((t) => t.path.join('.').startsWith(prefix));
}

/**
 * The `$type` a token at `path` would INHERIT — the nearest ancestor group declaring one, per DTCG's
 * inheritance rule. `undefined` when no group above it declares a type.
 *
 * This is the only inference a verb may make. Reading a SIBLING's type was wrong: siblings are peers,
 * not authorities, so it let one token's type silently decide another's — and it asked for `--type`
 * on the first token under a group that had already declared one, which is the case where the
 * document knows the answer perfectly well.
 */
export function inheritedTypeAt(
  document: Document,
  set: string,
  path: string[],
): string | undefined {
  let cursor = document.getFiles()[setFileName(set)];
  let type: string | undefined;

  // Every ancestor in turn, root first, so the NEAREST declaration wins.
  for (const segment of path.slice(0, -1)) {
    if (!cursor) return type;
    if (typeof cursor.$type === 'string') type = cursor.$type;
    const next = cursor[segment];
    cursor = next && typeof next === 'object' ? (next as DtcgNode) : undefined;
  }
  if (cursor && typeof cursor.$type === 'string') type = cursor.$type;
  return type;
}

/**
 * The value-notation options the project was loaded with. Defaults cover drivers that construct a
 * bare project (tests, the browser) — the CLI threads the configured space through `Project`.
 */
export function valueOptionsOf(ctx: CommandContext): { colorSpace: string } {
  const project = ctx.project as
    | { valueOptions?: { colorSpace: string } }
    | undefined;
  return project?.valueOptions ?? { colorSpace: 'oklch' };
}

/**
 * Parse a CLI-supplied value. Arguments arrive as strings, but DTCG values are not all strings:
 * `8` is a number, `{"value":4,"unit":"px"}` is an object, and `#c8102e` or `{color.base}` are
 * strings. JSON first, raw string as the fallback — which leaves references untouched, since
 * `{color.base}` is not valid JSON.
 */
export function parseValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
