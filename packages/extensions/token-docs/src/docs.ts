import { type Token, VTK_PREFIX } from '@vertekum/core';

/**
 * Notes on a token or a group — the contract a consumer reads.
 *
 * One `$extensions` key, one note per category, the text as authored (markdown included). The
 * categories are the project's own (`docs`, `llm`, `mcp`, or whatever it declares), so this file
 * fixes the SHAPE and never the vocabulary.
 *
 * ```jsonc
 * "$extensions": {
 *   "org.vertekum.docs": {
 *     "docs": "Use for body copy. Markdown **is** allowed.",
 *     "llm": "Prefer this over color.text.raw when summarising."
 *   }
 * }
 * ```
 */

/** The `$extensions` key notes live under. Stable: third-party readers key off exactly this. */
export const DOCS_KEY = `${VTK_PREFIX}.docs`;

/** Category → note. One note per category; setting a category again replaces its text. */
export type DocsPayload = Record<string, string>;

function asPayload(value: unknown): DocsPayload | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const out: DocsPayload = {};
  for (const [category, text] of Object.entries(value as DocsPayload)) {
    if (typeof text === 'string') out[category] = text;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * The notes on a token, or `undefined`. Exported so an exporter, an agent bridge or another
 * extension never hard-codes the key — and so a malformed payload reads as absent rather than
 * throwing inside someone else's build.
 */
export function docsOf(token: Token): DocsPayload | undefined {
  return asPayload(token.extensions?.[DOCS_KEY]);
}

/** The notes on any DTCG node (a group, or a token as it sits on disk). */
export function docsOfNode(
  node: Record<string, unknown> | undefined,
): DocsPayload | undefined {
  const extensions = node?.$extensions as Record<string, unknown> | undefined;
  return asPayload(extensions?.[DOCS_KEY]);
}

/** Merge one category's note into a payload; an empty string removes that category. */
export function withNote(
  payload: DocsPayload | undefined,
  category: string,
  text: string,
): DocsPayload {
  const next: DocsPayload = { ...payload };
  if (text === '') delete next[category];
  else next[category] = text;
  return next;
}
