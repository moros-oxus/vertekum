// `isReference` / `referenceToPath` now live in core (`dtcg.tokens.*`) — import them from `vertekum`.
// This file keeps only the editor-flavored helper for authoring a reference from a picked path.

/** Wrap a path as a reference string; a cleared (blank) field stays `''` — never a bare `{}`. */
export function pathToReference(text: string): string {
  return text.trim() === '' ? '' : `{${text}}`;
}
