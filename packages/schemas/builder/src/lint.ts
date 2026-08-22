import { assertOpenSetsAreNameSets, build, evaluateProduction } from './build';
import { DfnError } from './error';
import { resolveModule } from './resolve';

/**
 * Grammar-only validation of a `.dfn` module — the whole module, not just what a root reaches.
 *
 * `build --dry-run` validates incidentally: it expands from `root`, so a fragment's productions
 * and a rooted module's unused ones are parsed and nothing more. Lint's contract is the source
 * itself — every production evaluates (cycle-detected, references resolved, pick/omit members and
 * scales checked, open sets verified name-only), and diagnostics COLLECT: one broken production
 * does not hide the next one.
 */

export interface DfnDiagnostic {
  /** The module the position refers to — the linted file, unless the error names another. */
  file: string;
  line: number;
  column: number;
  message: string;
}

function toDiagnostic(file: string, error: unknown): DfnDiagnostic {
  if (error instanceof DfnError) {
    return {
      file: error.file ?? file,
      line: error.line,
      column: error.column,
      message: error.detail,
    };
  }
  return {
    file,
    line: 1,
    column: 1,
    message: error instanceof Error ? error.message : String(error),
  };
}

/** Lint one module. Returns every finding; an empty array means the grammar is sound. */
export function lintModule(
  path: string,
  sources?: Map<string, string>,
): DfnDiagnostic[] {
  let resolved: ReturnType<typeof resolveModule>;
  try {
    resolved = resolveModule(path, new Set(), sources);
  } catch (error) {
    return [toDiagnostic(path, error)];
  }

  const out: DfnDiagnostic[] = [];
  const collect = (walk: () => void): void => {
    try {
      walk();
    } catch (error) {
      out.push(toDiagnostic(path, error));
    }
  };

  for (const [name, node] of resolved.module.productions) {
    collect(() => {
      evaluateProduction(resolved, name);
      assertOpenSetsAreNameSets(resolved, node);
    });
  }
  if (resolved.module.root) {
    // `build` re-expands referenced productions, so a production's error can surface twice —
    // once from its own walk, once through the root. The dedupe below keeps one.
    collect(() => {
      build(resolved);
      assertOpenSetsAreNameSets(resolved);
    });
  }

  const seen = new Set<string>();
  return out.filter((d) => {
    const key = `${d.file}|${d.line}|${d.column}|${d.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
