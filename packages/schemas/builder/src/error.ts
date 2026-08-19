/** A syntax or semantic error in a `.dfn` module, positioned for the author. */
export class DfnError extends Error {
  readonly line: number;
  readonly column: number;

  constructor(message: string, line: number, column: number) {
    super(`${line}:${column} ${message}`);
    this.name = 'DfnError';
    this.line = line;
    this.column = column;
  }
}
