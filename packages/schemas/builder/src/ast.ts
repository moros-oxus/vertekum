/**
 * The definition-file AST — a normalized description of a `.dfn` module. Nodes describe the NAME
 * TREE a vocabulary permits: nesting (`.`), alternation (`|`), references (`<x>` / `<@x>`), and
 * range terms. The parser knows the grammar, not the semantics: a `ref` node knows its name is
 * `color-role`, not what that production expands to — expansion lives in the builder.
 */

/** A parsed module: imports, named productions, and the reserved `root` (absent in fragments). */
export interface Module {
  /** `use "<specifier>"` statements, in order: relative paths or package specifiers. */
  uses: string[];
  /** Productions by name. `root` is never stored here. */
  productions: Map<string, Node>;
  /** The reserved `root` production, when declared. */
  root: Node | undefined;
  /** Pragmas (`id "…"`, `title "…"`, `description "…"`) — document metadata for emission. */
  meta: ModuleMeta;
}

/** The pragma statements a module may carry, each at most once. */
export interface ModuleMeta {
  id?: string;
  title?: string;
  description?: string;
  /**
   * `scope "branch"`: the schema governs only the top-level branches it names — the document
   * root stays unsealed, so sibling vocabularies can bind over the same files. The default,
   * `document`, seals the root: nothing beyond the granted names may exist.
   */
  scope?: 'document' | 'branch';
}

export type Node = Alt | Path | Name | Range | Ref | Group;

/** `a | b | c` — set union of the options' name trees. */
export interface Alt {
  kind: 'alt';
  options: Node[];
}

/** `a.b.c` — nesting, one level per step, left to right. */
export interface Path {
  kind: 'path';
  steps: Step[];
}

/** One step of a path; `optional` records a trailing `?` (parsed, reserved — no artifact effect). */
export interface Step {
  term: Name | Range | Ref | Group;
  optional: boolean;
}

/** A literal name segment — an identifier or a bare number. */
export interface Name {
  kind: 'name';
  value: string;
}

/**
 * A numeric name scale, enumerated at build time. `min-max/step` is additive;
 * `min-max*factor` is geometric (fractional factors allowed), optionally quantized to the
 * nearest multiple of `quantum` (`~4`). A leading zero on a written endpoint (`025`)
 * declares the zero-pad width for every emitted name.
 */
export interface Range {
  kind: 'range';
  min: number;
  max: number;
  mode: 'stepped' | 'multiplied';
  /** The additive step, or the geometric factor. */
  step: number;
  quantum?: number;
  pad?: number;
}

/**
 * `<name>` / `<@name>`; `open` records a trailing `*` (the set admits additions). Set
 * modifiers: `[a, b]` is PICK (only the listed members), `![a, b]` is OMIT (the set minus
 * them) — a modified reference is a new set.
 */
export interface Ref {
  kind: 'ref';
  name: string;
  imported: boolean;
  /** `<@module/production>` — resolve `name` in this import alone (the collision resolver). */
  from?: string;
  open: boolean;
  pick: string[];
  omit: string[];
}

/** `[ … ]`; `open` records a trailing `*` before the closing bracket. */
export interface Group {
  kind: 'group';
  node: Node;
  open: boolean;
}
