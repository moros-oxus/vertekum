/** One command of a batch: where it came from, and its argument vector. */
export interface BatchStep {
  /** 1-based: the line in a lines batch, the entry in a JSON batch. */
  line: number;
  argv: string[];
}

/**
 * Split a command line into words the way a POSIX shell does, for what a batch needs: single quotes
 * are literal, double quotes honour `\"` and `\\`, a backslash outside quotes escapes the next
 * character, and `#` at the start of a word begins a comment. No expansion of any kind — a batch
 * line is data, never evaluated.
 */
export function splitWords(line: string): string[] {
  const words: string[] = [];
  let word = '';
  let inWord = false;
  let i = 0;
  while (i < line.length) {
    const c = line[i] as string;
    if (/\s/.test(c)) {
      if (inWord) words.push(word);
      word = '';
      inWord = false;
      i++;
    } else if (c === '#' && !inWord) {
      break;
    } else if (c === "'") {
      const end = line.indexOf("'", i + 1);
      if (end === -1) throw new Error('unterminated quote');
      word += line.slice(i + 1, end);
      inWord = true;
      i = end + 1;
    } else if (c === '"') {
      i++;
      for (;;) {
        if (i >= line.length) throw new Error('unterminated quote');
        const d = line[i] as string;
        if (d === '"') break;
        if (d === '\\' && (line[i + 1] === '"' || line[i + 1] === '\\')) {
          word += line[i + 1];
          i += 2;
        } else {
          word += d;
          i++;
        }
      }
      inWord = true;
      i++;
    } else if (c === '\\' && i + 1 < line.length) {
      word += line[i + 1];
      inWord = true;
      i += 2;
    } else {
      word += c;
      inWord = true;
      i++;
    }
  }
  if (inWord) words.push(word);
  return words;
}

/** A leading program name is optional, so lines copied from a script run as they are. */
function dropProgram(argv: string[]): string[] {
  return argv[0] === 'vertekum' || argv[0] === 'vtk' ? argv.slice(1) : argv;
}

/**
 * Read a batch: a JSON array of argument arrays when the text starts with `[`, else one command
 * per line (blank lines and `#` comments skipped). Malformed input throws, naming where.
 */
export function readBatch(text: string): BatchStep[] {
  if (text.trimStart().startsWith('[')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('batch is not valid JSON');
    }
    if (!Array.isArray(parsed)) throw new Error('batch is not valid JSON');
    return parsed.map((entry, index) => {
      if (
        !Array.isArray(entry) ||
        entry.some((word) => typeof word !== 'string')
      ) {
        throw new Error(`batch entry ${index + 1} must be an array of strings`);
      }
      return { line: index + 1, argv: dropProgram(entry as string[]) };
    });
  }
  const steps: BatchStep[] = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    let argv: string[];
    try {
      argv = splitWords(raw);
    } catch (error) {
      throw new Error(`line ${index + 1}: ${(error as Error).message}`);
    }
    const words = dropProgram(argv);
    if (words.length > 0) steps.push({ line: index + 1, argv: words });
  });
  return steps;
}
