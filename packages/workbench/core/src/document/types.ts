/**
 * A normalized token in the document store. Mode-agnostic: per-mode values and
 * theme semantics live in `value`/`extensions` and are owned by the ThemeProvider,
 * not the kernel (ADR-0012, ADR-0028).
 */
export interface Token {
  id: string;
  path: string[];
  type: string;
  value: unknown;
  /**
   * DTCG token-position `$ref` — the pointer, verbatim as authored (`$value` XOR `$ref`). When
   * present, `value` holds the MATERIALIZED result of evaluating it against the composed document
   * (the merged collection at parse; the composed bundle under a resolver selection — undefined
   * when it dangles or cycles, see `refIssue`), and the write path emits `$ref`.
   */
  ref?: string;
  /** Why a `ref` failed to materialize IN THE SCOPE THAT PRODUCED THIS TOKEN; absent when it resolved. */
  refIssue?: 'dangling' | 'cycle';
  /**
   * The authored `$value` when it contains value-position pointer objects (`{"$ref": "#/…"}`).
   * `value` holds the materialized deep copy; the write path emits THIS, so the author's notation
   * survives any whole-node rewrite (move, restore, replace).
   */
  sourceValue?: unknown;
  /** DTCG `$description` — a human-readable note about the token's purpose. */
  description?: string;
  /**
   * The set this token belongs to — its source file's name minus `.json` (set = file).
   * `parseCollection` always stamps it; brand-new in-editor tokens fall back to the default set
   * (`'tokens'`) at save time. Not a semantic field — `diffTokens` ignores it.
   */
  set?: string;
  /**
   * Vertekum per-token metadata, keyed by premise sub-name (`meta`, `themes`, …) — the
   * `org.vertekum.*` `$extensions` sub-keys minus `ident` (which is lifted to `id`). (ADR-0020)
   */
  vtk?: Record<string, unknown>;
  /** Foreign vendor `$extensions` (non-`org.vertekum.*`), preserved untouched. */
  extensions?: Record<string, unknown>;
  /**
   * The `$extensions` key of the codec that materialized this token from a carrier node
   * (extension-held token data). Present = the store form is a conformant empty-group carrier and
   * every write goes back through the codec; absent = an ordinary token node.
   */
  codec?: string;
  /**
   * The carrier payload as parsed, stamped alongside `codec`. A codec whose payload is a
   * DERIVATION (a formula the value is computed from) reads this in `serialize` — the stored
   * source cannot be reconstructed from the computed value alone, and it travels with the token
   * through moves, replaces, and value edits.
   */
  codecSource?: unknown;
  /**
   * True for a token a GROUP codec generated (one payload → many tokens). A view, not storage:
   * no file node exists at its path, the store never writes it, and the curation verbs refuse to
   * mutate it — the group's payload is the single source.
   */
  generated?: true;
}
