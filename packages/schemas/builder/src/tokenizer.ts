import { DfnError } from './error';

/**
 * The `.dfn` lexer. Line-aware (statements are line-oriented), producing a flat token stream the
 * parser walks. `#` comments run to end of line. A term starting with a digit is numeric — a
 * NUMBER (`950`) or a RANGE (`100-300/50`) — so hyphens inside identifiers (`color-role`) never
 * collide with range syntax.
 */

export type TokenKind =
  | 'ident'
  | 'number'
  | 'range'
  | 'string'
  | 'use'
  | 'equals'
  | 'dot'
  | 'pipe'
  | 'lbracket'
  | 'rbracket'
  | 'langle'
  | 'rangle'
  | 'at'
  | 'star'
  | 'question'
  | 'comma'
  | 'bang'
  | 'slash'
  | 'newline'
  | 'eof';

export interface Token {
  kind: TokenKind;
  /** Source text (for ident/number/string); ranges carry their parsed payload instead. */
  value: string;
  range?: {
    min: number;
    max: number;
    /** `/` = stepped (additive), `*` = multiplied (geometric). */
    mode: '/' | '*';
    step: number;
    quantum?: number;
    /** Pad width inferred from a leading zero on a written endpoint (`025` → 3). */
    pad?: number;
  };
  line: number;
  column: number;
}

const IDENT = /^[A-Za-z][A-Za-z0-9-]*/;
const RANGE = /^(\d+)-(\d+)([*/])(\d+(?:\.\d+)?)(?:~(\d+))?/;
const NUMBER = /^\d+/;

/** "Write the numbers as they appear": a leading zero declares the pad width. */
function padWidth(...literals: string[]): number | undefined {
  const declared = literals.filter((l) => l.length > 1 && l.startsWith('0'));
  if (declared.length === 0) return undefined;
  return Math.max(...declared.map((l) => l.length));
}

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  const lines = source.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = i + 1;
    let text = lines[i];
    const commentAt = text.indexOf('#');
    if (commentAt !== -1) text = text.slice(0, commentAt);

    // Continuation by indentation: a line that starts with whitespace continues the statement
    // above it, so a long expression can wrap without any continuation character.
    if (
      /^\s/.test(text) &&
      text.trim().length > 0 &&
      tokens[tokens.length - 1]?.kind === 'newline'
    ) {
      tokens.pop();
    }

    let column = 1;
    while (text.length > 0) {
      const ws = text.match(/^\s+/);
      if (ws) {
        column += ws[0].length;
        text = text.slice(ws[0].length);
        continue;
      }

      const push = (kind: TokenKind, value: string): void => {
        tokens.push({ kind, value, line, column });
        column += value.length;
        text = text.slice(value.length);
      };

      const range = text.match(RANGE);
      if (range) {
        tokens.push({
          kind: 'range',
          value: range[0],
          range: {
            min: Number(range[1]),
            max: Number(range[2]),
            mode: range[3] as '/' | '*',
            step: Number(range[4]),
            quantum: range[5] ? Number(range[5]) : undefined,
            pad: padWidth(range[1], range[2]),
          },
          line,
          column,
        });
        column += range[0].length;
        text = text.slice(range[0].length);
        continue;
      }
      const number = text.match(NUMBER);
      if (number) {
        push('number', number[0]);
        continue;
      }
      const ident = text.match(IDENT);
      if (ident) {
        push(ident[0] === 'use' ? 'use' : 'ident', ident[0]);
        continue;
      }
      if (text.startsWith('"')) {
        const end = text.indexOf('"', 1);
        if (end === -1) throw new DfnError('unterminated string', line, column);
        const raw = text.slice(0, end + 1);
        tokens.push({ kind: 'string', value: raw.slice(1, -1), line, column });
        column += raw.length;
        text = text.slice(raw.length);
        continue;
      }

      const single: Record<string, TokenKind> = {
        '=': 'equals',
        '.': 'dot',
        '|': 'pipe',
        '[': 'lbracket',
        ']': 'rbracket',
        '<': 'langle',
        '>': 'rangle',
        '@': 'at',
        '*': 'star',
        '?': 'question',
        ',': 'comma',
        '!': 'bang',
        '/': 'slash',
      };
      const kind = single[text[0]];
      if (!kind) throw new DfnError(`unexpected '${text[0]}'`, line, column);
      push(kind, text[0]);
    }

    tokens.push({ kind: 'newline', value: '\n', line, column });
  }

  tokens.push({ kind: 'eof', value: '', line: lines.length + 1, column: 1 });
  return tokens;
}
