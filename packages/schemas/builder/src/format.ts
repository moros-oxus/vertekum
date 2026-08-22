import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { type Token, tokenize } from './tokenizer';

/**
 * The `.dfn` formatter: JS-literal block formatting with authorial break choices.
 *
 * Inline vs block is the author's call — a `[` with content on its line stays inline, a `[`
 * followed by a newline is a block. The formatter owns everything inside that choice: block
 * indentation (+1 unit per level, closer dedented to its opener's line), canonical token
 * spacing, comment placement, and whitespace hygiene. It never moves a line break.
 */

export interface FormatOptions {
  /** One indent unit (a run of spaces, or '\t'). Default two spaces. */
  indent: string;
}

/** Micro-spacing is canonical — one style, no knobs. The seam exists so a knob could. */
const DEFAULT_OPTIONS: FormatOptions = { indent: '  ' };

/** Split one source line into its code part and its `#` comment (strings respected). */
function splitComment(line: string): { code: string; comment: string | null } {
  let inString = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inString = !inString;
    if (ch === '#' && !inString) {
      return { code: line.slice(0, i), comment: line.slice(i).trimEnd() };
    }
  }
  return { code: line, comment: null };
}

/** The token's source text, re-quoted for strings. */
function text(token: Token): string {
  return token.kind === 'string' ? `"${token.value}"` : token.value;
}

const TIGHT_AFTER = new Set([
  'dot',
  'langle',
  'at',
  'slash',
  'bang',
  'lbracket',
]);
const TIGHT_BEFORE = new Set([
  'dot',
  'comma',
  'question',
  'rangle',
  'rbracket',
]);

/** The separator between two adjacent tokens on one line. */
function separator(prev: Token, cur: Token, next: Token | undefined): string {
  // `*` is tight inside a reference (`<x*>`), spaced before a group closer (`[a | b *]`).
  if (cur.kind === 'star') return next?.kind === 'rangle' ? '' : ' ';
  if (prev.kind === 'star') return ''; // always immediately before its closer
  if (TIGHT_AFTER.has(prev.kind)) return '';
  if (TIGHT_BEFORE.has(cur.kind)) return '';
  return ' ';
}

/** Re-emit one line's tokens under the canonical spacing rules. */
function printTokens(tokens: Token[]): string {
  let out = '';
  for (let i = 0; i < tokens.length; i++) {
    if (i > 0) out += separator(tokens[i - 1], tokens[i], tokens[i + 1]);
    out += text(tokens[i]);
  }
  return out;
}

/**
 * Format a module's source. Throws (a DfnError from the tokenizer) when the source cannot be
 * lexed — a broken module is lint's report; the formatter never rewrites what it cannot read.
 */
export function formatSource(
  source: string,
  options: FormatOptions = DEFAULT_OPTIONS,
): string {
  // One pass over the whole source: per-line token groups, and which bracket tokens belong to
  // BLOCK pairs (opener and closer on different lines) — only those contribute indent levels.
  const tokens = tokenize(source);
  const byLine = new Map<number, Token[]>();
  const blockBrackets = new Set<Token>();
  const opens: Token[] = [];
  for (const token of tokens) {
    if (token.kind === 'newline' || token.kind === 'eof') continue;
    const list = byLine.get(token.line) ?? [];
    list.push(token);
    byLine.set(token.line, list);
    if (token.kind === 'lbracket') opens.push(token);
    if (token.kind === 'rbracket') {
      const open = opens.pop();
      if (open && open.line !== token.line) {
        blockBrackets.add(open);
        blockBrackets.add(token);
      }
    }
  }

  const lines = source.split('\n');
  const out: string[] = [];
  let level = 0;
  let blankRun = 0;

  for (let i = 0; i < lines.length; i++) {
    const { comment } = splitComment(lines[i]);
    const lineTokens = byLine.get(i + 1) ?? [];

    if (lineTokens.length === 0 && comment === null) {
      blankRun += 1;
      continue;
    }
    // Runs of blank lines collapse to one; none at the start of the file.
    if (blankRun > 0 && out.length > 0) out.push('');
    blankRun = 0;

    // A leading run of block closers sits at its openers' level, one step back each.
    let leadingClosers = 0;
    for (const token of lineTokens) {
      if (token.kind === 'rbracket' && blockBrackets.has(token))
        leadingClosers += 1;
      else break;
    }
    const startLevel = Math.max(0, level - leadingClosers);
    for (const token of lineTokens) {
      if (!blockBrackets.has(token)) continue;
      if (token.kind === 'lbracket') level += 1;
      if (token.kind === 'rbracket') level = Math.max(0, level - 1);
    }

    const indent = options.indent.repeat(startLevel);
    const code = printTokens(lineTokens);
    if (comment !== null) {
      out.push(
        code.length > 0
          ? `${indent}${code}  ${comment}`
          : `${indent}${comment}`,
      );
    } else {
      out.push(indent + code);
    }
  }

  return `${out.join('\n')}\n`;
}

/**
 * Resolve the indent unit for a `.dfn` file: the project's `format.indent` when set, else the
 * nearest `.editorconfig` (`[*.dfn]` over `[*]`, closest file wins, `root = true` stops the
 * walk), else two spaces.
 */
export function resolveIndent(
  filePath: string,
  projectIndent?: string | number,
): string {
  if (typeof projectIndent === 'number') return ' '.repeat(projectIndent);
  if (typeof projectIndent === 'string') return projectIndent;

  let dir = dirname(filePath);
  const configs: string[] = [];
  for (;;) {
    const candidate = join(dir, '.editorconfig');
    if (existsSync(candidate)) {
      const content = readFileSync(candidate, 'utf8');
      configs.push(content);
      if (/^\s*root\s*=\s*true\s*$/im.test(content)) break;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // Farthest file first, so closer files (and later sections within a file) override.
  let style: string | undefined;
  let size: string | undefined;
  for (const content of configs.reverse()) {
    let applies = false;
    for (const raw of content.split('\n')) {
      const line = raw.trim();
      const section = line.match(/^\[(.+)\]$/);
      if (section) {
        const glob = section[1];
        applies =
          glob === '*' ||
          glob === '**' ||
          /(^|[*{,])dfn[},]?$|\*\.dfn/.test(glob);
        continue;
      }
      if (!applies) continue;
      const pair = line.match(/^([A-Za-z_]+)\s*=\s*(.+)$/);
      if (!pair) continue;
      if (pair[1] === 'indent_style') style = pair[2].trim();
      if (pair[1] === 'indent_size') size = pair[2].trim();
    }
  }

  if (style === 'tab') return '\t';
  const width = size !== undefined ? Number.parseInt(size, 10) : Number.NaN;
  if (Number.isFinite(width) && width > 0) return ' '.repeat(width);
  return DEFAULT_OPTIONS.indent;
}

/** One applied repair. */
export interface DfnFix {
  line: number;
  column: number;
  message: string;
}

/**
 * Apply the mechanical, unambiguous repairs — currently one: a trailing open-set mark
 * (`<name>*` → `<name*>`, `[a | b]*` → `[a | b *]`). Repaired lines are re-emitted through the
 * canonical printer; untouched lines stay verbatim. A source that cannot be lexed fixes nothing.
 */
export function fixSource(source: string): {
  content: string;
  fixes: DfnFix[];
} {
  let tokens: Token[];
  try {
    tokens = tokenize(source);
  } catch {
    return { content: source, fixes: [] };
  }

  const byLine = new Map<number, Token[]>();
  for (const token of tokens) {
    if (token.kind === 'newline' || token.kind === 'eof') continue;
    const list = byLine.get(token.line) ?? [];
    list.push(token);
    byLine.set(token.line, list);
  }

  const fixes: DfnFix[] = [];
  const lines = source.split('\n');
  for (const [line, lineTokens] of byLine) {
    let repaired = false;
    for (let i = 0; i + 1 < lineTokens.length; i++) {
      const closer = lineTokens[i];
      const star = lineTokens[i + 1];
      if (
        (closer.kind === 'rangle' || closer.kind === 'rbracket') &&
        star.kind === 'star'
      ) {
        lineTokens[i] = star;
        lineTokens[i + 1] = closer;
        repaired = true;
        fixes.push({
          line,
          column: star.column,
          message: `moved '*' inside the ${closer.kind === 'rangle' ? 'reference' : 'group'} it opens`,
        });
      }
    }
    if (repaired) {
      const raw = lines[line - 1];
      const { comment } = splitComment(raw);
      const leading = raw.match(/^\s*/)?.[0] ?? '';
      const code = printTokens(lineTokens);
      lines[line - 1] =
        comment !== null ? `${leading}${code}  ${comment}` : leading + code;
    }
  }

  return { content: lines.join('\n'), fixes };
}
