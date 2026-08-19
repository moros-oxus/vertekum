import type { Alt, Module, Node, Path, Step } from './ast';
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
    const uses: string[] = [];
    const productions = new Map<string, Node>();
    let root: Node | undefined;

    this.skipNewlines();
    while (this.peek().kind !== 'eof') {
      const token = this.peek();
      if (token.kind === 'use') {
        this.next();
        uses.push(this.expect('string', 'a quoted specifier').value);
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
      if (this.peek().kind !== 'eof') this.expect('newline', 'end of line');
      this.skipNewlines();
    }

    return { uses, productions, root };
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

  private term(): Step['term'] {
    const token = this.next();
    switch (token.kind) {
      case 'ident':
      case 'number':
        return { kind: 'name', value: token.value };
      case 'range': {
        const { min, max, step } = token.range as {
          min: number;
          max: number;
          step: number;
        };
        if (step === 0 || max < min) {
          throw new DfnError(
            'range needs max >= min and a non-zero step',
            token.line,
            token.column,
          );
        }
        return { kind: 'range', min, max, step };
      }
      case 'langle': {
        const imported = this.peek().kind === 'at';
        if (imported) this.next();
        const name = this.expect('ident', 'a production name');
        const open = this.peek().kind === 'star';
        if (open) this.next();
        this.expect('rangle', "'>'");
        return { kind: 'ref', name: name.value, imported, open };
      }
      case 'lbracket': {
        const node = this.alternation();
        const open = this.peek().kind === 'star';
        if (open) this.next();
        this.expect('rbracket', "']'");
        return { kind: 'group', node, open };
      }
      default:
        throw new DfnError(
          `expected a term, got '${token.value || token.kind}'`,
          token.line,
          token.column,
        );
    }
  }
}
