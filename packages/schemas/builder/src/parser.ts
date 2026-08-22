import type { Alt, Module, ModuleMeta, Node, Path, Step } from './ast';
import { DfnError } from './error';
import { type Token, tokenize } from './tokenizer';

/**
 * Recursive-descent parser for `.dfn` modules. Statements are line-oriented: `use "<spec>"` or
 * `name = expression`. Precedence: `.` binds tighter than `|`; `?` is postfix on the preceding
 * step; `*` sits before a closing `>` or `]` and marks the set open. `root` is the reserved
 * production `build` materializes — stored apart so fragments-only modules stay valid.
 */
export function parse(source: string): Module {
  return new Parser(tokenize(source)).module();
}

class Parser {
  private readonly tokens: Token[];
  private index = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.index];
  }

  private at(offset: number): Token | undefined {
    return this.tokens[this.index + offset];
  }

  private next(): Token {
    return this.tokens[this.index++];
  }

  private expect(kind: Token['kind'], what: string): Token {
    const token = this.next();
    if (token.kind !== kind) {
      throw new DfnError(
        `expected ${what}, got '${token.value || token.kind}'`,
        token.line,
        token.column,
      );
    }
    return token;
  }

  private skipNewlines(): void {
    while (this.peek().kind === 'newline') this.next();
  }

  module(): Module {
    const uses: Array<{ spec: string; alias?: string }> = [];
    const productions = new Map<string, Node>();
    const meta: ModuleMeta = {};
    let root: Node | undefined;

    this.skipNewlines();
    while (this.peek().kind !== 'eof') {
      const token = this.peek();
      if (token.kind === 'use') {
        this.next();
        const spec = this.expect('string', 'a quoted specifier').value;
        let alias: string | undefined;
        if (this.peek().kind === 'ident' && this.peek().value === 'as') {
          this.next();
          alias = this.expect('ident', 'an import alias').value;
        }
        uses.push({ spec, alias });
      } else if (token.kind === 'ident' && this.at(1)?.kind === 'string') {
        // `<ident> "<string>"` (no `=`) is a PRAGMA — document metadata, not a production, so
        // nothing is reserved: `title = a | b` still declares a production named title.
        const name = this.next();
        const value = this.next().value;
        if (
          name.value !== 'id' &&
          name.value !== 'title' &&
          name.value !== 'description' &&
          name.value !== 'scope'
        ) {
          throw new DfnError(
            `unknown pragma '${name.value}' — id, title, description, and scope exist`,
            name.line,
            name.column,
          );
        }
        const key = name.value as keyof ModuleMeta;
        if (meta[key] !== undefined) {
          throw new DfnError(
            `duplicate pragma '${name.value}'`,
            name.line,
            name.column,
          );
        }
        if (key === 'scope') {
          if (value !== 'document' && value !== 'branch') {
            throw new DfnError(
              `scope is "document" or "branch", not "${value}"`,
              name.line,
              name.column,
            );
          }
          meta.scope = value;
        } else {
          meta[key] = value;
        }
      } else if (token.kind === 'ident') {
        const name = this.next();
        this.expect('equals', "'='");
        const expression = this.alternation();
        if (name.value === 'root') {
          if (root) {
            throw new DfnError(
              'a module declares one root',
              name.line,
              name.column,
            );
          }
          root = expression;
        } else {
          if (productions.has(name.value)) {
            throw new DfnError(
              `duplicate production '${name.value}'`,
              name.line,
              name.column,
            );
          }
          productions.set(name.value, expression);
        }
      } else {
        throw new DfnError(
          `expected a statement, got '${token.value || token.kind}'`,
          token.line,
          token.column,
        );
      }
      // `<scale>*` — the open-set mark after a closed `>`/`]` lands here as a stray
      // statement tail; name the fix rather than complaining about the line ending.
      if (this.peek().kind === 'star') {
        const star = this.peek();
        throw new DfnError(
          "'*' marks a set open and sits inside the reference or group it opens — <name*> or [a | b *]",
          star.line,
          star.column,
        );
      }
      if (this.peek().kind !== 'eof') this.expect('newline', 'end of line');
      this.skipNewlines();
    }

    return { uses, productions, root, meta };
  }

  /** `a | b | c` — a single option collapses to itself. */
  private alternation(): Node {
    const options: Node[] = [this.path()];
    while (this.peek().kind === 'pipe') {
      this.next();
      options.push(this.path());
    }
    if (options.length === 1) return options[0];
    const alt: Alt = { kind: 'alt', options };
    return alt;
  }

  /** `a.b.c` — a single step with no `?` collapses to its term. */
  private path(): Node {
    const steps: Step[] = [this.step()];
    while (this.peek().kind === 'dot') {
      this.next();
      steps.push(this.step());
    }
    if (steps.length === 1 && !steps[0].optional) return steps[0].term;
    const path: Path = { kind: 'path', steps };
    return path;
  }

  private step(): Step {
    const term = this.term();
    let optional = false;
    if (this.peek().kind === 'question') {
      this.next();
      optional = true;
    }
    return { term, optional };
  }

  /** A pick/omit list member: an identifier or a (possibly padded) number. */
  private member(): string {
    const token = this.next();
    if (token.kind !== 'ident' && token.kind !== 'number') {
      throw new DfnError(
        `expected a member name, got '${token.value || token.kind}'`,
        token.line,
        token.column,
      );
    }
    return token.value;
  }

  private term(): Step['term'] {
    const token = this.next();
    const at = { line: token.line, column: token.column };
    switch (token.kind) {
      case 'ident':
      case 'number':
        return { kind: 'name', value: token.value, ...at };
      case 'range': {
        const payload = token.range as NonNullable<Token['range']>;
        const { min, max, mode, step, quantum, pad, prefix, suffix } = payload;
        const affixes = {
          ...(prefix !== undefined ? { prefix } : {}),
          ...(suffix !== undefined ? { suffix } : {}),
        };
        if (max < min) {
          throw new DfnError(
            'range needs max >= min',
            token.line,
            token.column,
          );
        }
        if (mode === '/') {
          if (quantum !== undefined) {
            throw new DfnError(
              '~quantum belongs to multiplied scales (min-max*factor~q)',
              token.line,
              token.column,
            );
          }
          if (step === 0 || !Number.isInteger(step)) {
            throw new DfnError(
              'a stepped range needs a whole-number step greater than zero',
              token.line,
              token.column,
            );
          }
          return {
            kind: 'range',
            min,
            max,
            mode: 'stepped',
            step,
            pad,
            ...affixes,
            ...at,
          };
        }
        if (step <= 1) {
          throw new DfnError(
            'a multiplied range needs a factor greater than one',
            token.line,
            token.column,
          );
        }
        return {
          kind: 'range',
          min,
          max,
          mode: 'multiplied',
          step,
          quantum,
          pad,
          ...affixes,
          ...at,
        };
      }
      case 'langle': {
        const imported = this.peek().kind === 'at';
        if (imported) this.next();
        let name = this.expect('ident', 'a production name');
        // `<@module/production>` — qualified access to one import's production.
        let from: string | undefined;
        if (this.peek().kind === 'slash') {
          if (!imported) {
            const bad = this.peek();
            throw new DfnError(
              'a qualified reference is an import — write <@module/name>',
              bad.line,
              bad.column,
            );
          }
          this.next();
          from = name.value;
          name = this.expect('ident', 'a production name');
        }
        // Set modifiers: `[a, b]` picks only the listed members; `![a, b]` omits them.
        const pick: string[] = [];
        const omit: string[] = [];
        const negated = this.peek().kind === 'bang';
        if (negated) this.next();
        if (this.peek().kind === 'lbracket') {
          const into = negated ? omit : pick;
          this.next();
          into.push(this.member());
          while (this.peek().kind === 'comma') {
            this.next();
            into.push(this.member());
          }
          this.expect('rbracket', "']'");
        } else if (negated) {
          const bad = this.peek();
          throw new DfnError(
            "'!' must be followed by a [list]",
            bad.line,
            bad.column,
          );
        }
        const open = this.peek().kind === 'star';
        if (open) this.next();
        this.expect('rangle', "'>'");
        return {
          kind: 'ref',
          name: name.value,
          imported,
          from,
          open,
          pick,
          omit,
          ...at,
        };
      }
      case 'lbracket': {
        const node = this.alternation();
        const open = this.peek().kind === 'star';
        if (open) this.next();
        this.expect('rbracket', "']'");
        return { kind: 'group', node, open, ...at };
      }
      case 'star':
        // The most common misplacement: `color.*` or `a | *`. The mark exists — it just
        // sits inside the set it opens, so say that instead of a bare grammar complaint.
        throw new DfnError(
          "'*' marks a set open and sits inside the reference or group it opens — <name*> or [a | b *]",
          token.line,
          token.column,
        );
      default:
        throw new DfnError(
          `expected a term, got '${token.value || token.kind}'`,
          token.line,
          token.column,
        );
    }
  }
}
