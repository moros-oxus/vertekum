import { dtcg, type Token } from '@vertekum/core';

/**
 * CSS custom-property names keep their token's case.
 *
 * `@terrazzo/plugin-css` lowercases every declaration it writes: its build passes the declared
 * name through `makeCSSVar` again, even when a custom `variableName` produced it, while alias
 * references (`var(…)`) keep that custom name as given. A token with a capital in its path
 * (`color.neutral.A100`, an alpha ramp twin) is then declared one way and referenced another —
 * or, under the default naming, declared and referenced in lowercase only.
 *
 * This restores the authored case in the CSS Terrazzo wrote, declarations and references alike,
 * so the two agree by construction whatever the consumer's `variableName` does. A name is
 * rewritten only when the LONGEST token name its tail matches (case-insensitively, on a `-`
 * boundary) is a cased one: a lowercase path that merely ends like a cased one keeps its name.
 * Two paths differing only by case are ambiguous and both are left alone. Once Terrazzo uses a
 * custom `variableName` verbatim for declarations, this finds nothing to change.
 */
export function restoreNameCase(css: string, tokens: Token[]): string {
  // Lowercased kebab name → the authored spelling, or null when two spellings collide.
  const spelled = new Map<string, string | null>();
  let anyCased = false;
  for (const token of tokens) {
    const kebab = dtcg.tokens.exportPath(token.path).join('-');
    const key = kebab.toLowerCase();
    if (kebab !== key) anyCased = true;
    const held = spelled.get(key);
    if (held === undefined) spelled.set(key, kebab);
    else if (held !== kebab) spelled.set(key, null);
  }
  if (!anyCased) return css;

  return css.replace(/--([A-Za-z0-9_-]+)/g, (whole, name: string) => {
    const lower = name.toLowerCase();
    // The longest token name the tail matches: the whole name, or a `-`-bounded suffix of it.
    let start = 0;
    while (start <= lower.length) {
      const tail = lower.slice(start);
      const spelling = spelled.get(tail);
      if (spelling !== undefined) {
        if (spelling === null || spelling === tail) return whole;
        return `--${name.slice(0, start)}${spelling}`;
      }
      const next = lower.indexOf('-', start);
      if (next === -1) return whole;
      start = next + 1;
    }
    return whole;
  });
}
