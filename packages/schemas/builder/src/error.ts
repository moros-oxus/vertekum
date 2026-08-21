/** A syntax or semantic error in a `.dfn` module, positioned for the author. */
export class DfnError extends Error {
  readonly line: number;
  readonly column: number;
  /** The module the position refers to, when the thrower knows it (multi-file runs). */
  readonly file?: string;
  /** The bare message, without the position prefix — what a diagnostic report carries. */
  readonly detail: string;

  constructor(message: string, line: number, column: number, file?: string) {
    super(`${file ? `${file}:` : ''}${line}:${column} ${message}`);
    this.name = 'DfnError';
    this.line = line;
    this.column = column;
    this.file = file;
    this.detail = message;
  }
}
