/**
 * Writing a token file in its own key order.
 *
 * Files are parsed into plain objects, and a plain object puts canonical integer keys (`"100"`,
 * `"600"`) first, in numeric order, ahead of every other key (`"050"`, `"$type"`, `"A100"`). Written
 * back naively, a file moves `"050"` after `"600"`. So a write reads the file's CURRENT text for
 * each object's key order and serializes the new content in that order: keys the source had, in
 * its order; keys it didn't, after them. The format is otherwise exactly
 * `JSON.stringify(value, null, indent)`, so an unchanged file is reproduced byte for byte.
 */

/** Object key orders by path — path segments joined with NUL (array items by index). */
export type KeyOrder = Map<string, string[]>;

const pathKey = (path: string[]): string => path.join('\u0000');

/**
 * Scan JSON text for every object's keys, in source order. Text that does not scan (it would not
 * have parsed either) yields an empty map — the write then falls back to model order.
 */
export function keyOrder(text: string): KeyOrder {
  const orders: KeyOrder = new Map();
  let i = 0;
  const skipSpace = () => {
    while (i < text.length && /\s/.test(text[i] as string)) i++;
  };
  const readString = (): string => {
    const start = i;
    i++; // opening quote
    while (i < text.length && text[i] !== '"') i += text[i] === '\\' ? 2 : 1;
    i++; // closing quote
    return JSON.parse(text.slice(start, i)) as string;
  };
  const readValue = (path: string[]): void => {
    skipSpace();
    const c = text[i];
    if (c === '{') {
      i++;
      const keys: string[] = [];
      skipSpace();
      if (text[i] === '}') {
        i++;
      } else {
        for (;;) {
          skipSpace();
          const key = readString();
          keys.push(key);
          skipSpace();
          i++; // ':'
          readValue([...path, key]);
          skipSpace();
          if (text[i++] === '}') break; // else ','
        }
      }
      orders.set(pathKey(path), keys);
    } else if (c === '[') {
      i++;
      skipSpace();
      if (text[i] === ']') {
        i++;
        return;
      }
      for (let index = 0; ; index++) {
        readValue([...path, String(index)]);
        skipSpace();
        if (text[i++] === ']') break; // else ','
      }
    } else if (c === '"') {
      readString();
    } else {
      while (i < text.length && !/[\s,}\]]/.test(text[i] as string)) i++;
    }
  };
  try {
    readValue([]);
  } catch {
    return new Map();
  }
  return orders;
}

/** Keys in the template's order where it speaks, then the rest in model order. */
function ordered(keys: string[], template: string[] | undefined): string[] {
  if (!template) return keys;
  const present = new Set(keys);
  const known = new Set(template);
  return [
    ...template.filter((key) => present.has(key)),
    ...keys.filter((key) => !known.has(key)),
  ];
}

/**
 * `JSON.stringify(value, null, indent)`, with each object's keys in `order` where it records one.
 * Values JSON cannot hold behave as JSON.stringify does: dropped from objects, `null` in arrays.
 */
export function stringifyOrdered(
  value: unknown,
  order: KeyOrder,
  indent: string | number,
): string {
  const gap =
    typeof indent === 'number'
      ? ' '.repeat(Math.min(10, Math.max(0, indent)))
      : indent.slice(0, 10);
  const emit = (
    held: unknown,
    path: string[],
    current: string,
  ): string | undefined => {
    if (
      held === undefined ||
      typeof held === 'function' ||
      typeof held === 'symbol'
    ) {
      return undefined;
    }
    if (held === null || typeof held !== 'object') return JSON.stringify(held);
    const inner = current + gap;
    const open = gap ? `\n${inner}` : '';
    const close = gap ? `\n${current}` : '';
    const separator = gap ? `,\n${inner}` : ',';
    if (Array.isArray(held)) {
      if (held.length === 0) return '[]';
      const items = held.map(
        (item, index) => emit(item, [...path, String(index)], inner) ?? 'null',
      );
      return `[${open}${items.join(separator)}${close}]`;
    }
    const record = held as Record<string, unknown>;
    const members: string[] = [];
    for (const key of ordered(Object.keys(record), order.get(pathKey(path)))) {
      const member = emit(record[key], [...path, key], inner);
      if (member !== undefined) {
        members.push(`${JSON.stringify(key)}:${gap ? ' ' : ''}${member}`);
      }
    }
    if (members.length === 0) return '{}';
    return `{${open}${members.join(separator)}${close}}`;
  };
  return emit(value, [], '') ?? 'undefined';
}
