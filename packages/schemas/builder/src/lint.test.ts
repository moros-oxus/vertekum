import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { lintModule } from './lint';

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

function fixture(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'vtk-lint-'));
  dirs.push(dir);
  for (const [name, content] of Object.entries(files)) {
    const path = join(dir, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  return dir;
}

test('a clean module yields no diagnostics', () => {
  const dir = fixture({
    'color.dfn': 'emphasis = subtle | bold\nroot = color.<emphasis>\n',
  });
  expect(lintModule(join(dir, 'color.dfn'))).toEqual([]);
});

test('a fragment with a broken production is caught — the build sweep never sees this', () => {
  const dir = fixture({
    'emphasis.dfn': 'emphasis = subtle | <missing>\n',
  });
  const diagnostics = lintModule(join(dir, 'emphasis.dfn'));
  expect(diagnostics).toHaveLength(1);
  expect(diagnostics[0].message).toContain("unknown production '<missing>'");
  expect(diagnostics[0].line).toBe(1);
  expect(diagnostics[0].column).toBe(21);
});

test('an unused production in a rooted module is evaluated', () => {
  const dir = fixture({
    'color.dfn': ['root = color.base', 'orphan = a | <nowhere>', ''].join('\n'),
  });
  const diagnostics = lintModule(join(dir, 'color.dfn'));
  expect(diagnostics).toHaveLength(1);
  expect(diagnostics[0].message).toContain("unknown production '<nowhere>'");
});

test('findings collect: one broken production does not hide the next', () => {
  const dir = fixture({
    'color.dfn': [
      'a = <missing-one>',
      'b = <missing-two>',
      'root = color.<a>',
      '',
    ].join('\n'),
  });
  const messages = lintModule(join(dir, 'color.dfn')).map((d) => d.message);
  expect(messages).toHaveLength(2);
  expect(messages[0]).toContain('missing-one');
  expect(messages[1]).toContain('missing-two');
});

test('a root error surfaces once, not once per reaching path', () => {
  const dir = fixture({
    'color.dfn': ['scale = 100 | 200', 'root = color.<scale ![300]>', ''].join(
      '\n',
    ),
  });
  const diagnostics = lintModule(join(dir, 'color.dfn'));
  expect(diagnostics).toHaveLength(1);
  expect(diagnostics[0].message).toContain("no member '300' to omit");
  expect(diagnostics[0].line).toBe(2);
});

test('a parse error in an imported fragment is attributed to that file', () => {
  const dir = fixture({
    'color.dfn': 'use "./broken.dfn"\nroot = color.<@emphasis>\n',
    'broken.dfn': 'emphasis = subtle | *\n',
  });
  const diagnostics = lintModule(join(dir, 'color.dfn'));
  expect(diagnostics).toHaveLength(1);
  expect(diagnostics[0].file).toBe(join(dir, 'broken.dfn'));
  expect(diagnostics[0].message).toContain("'*' marks a set open");
});

test('an evaluation error inside an imported module is attributed to that file', () => {
  const dir = fixture({
    'primitives.dfn': 'use "./common/size.dfn"\n\nroot = t.<@size>\n',
    'common/size.dfn': '# size\n\n\n\nsize = a | <@t-shirt/sm>\n',
  });
  const diagnostics = lintModule(join(dir, 'primitives.dfn'));
  expect(diagnostics).toHaveLength(1);
  expect(diagnostics[0].file).toBe(join(dir, 'common/size.dfn'));
  expect(diagnostics[0].line).toBe(5);
  expect(diagnostics[0].message).toContain("no import named 't-shirt'");
});

test('referencing a fragment by module name explains the fix and lists its productions', () => {
  const dir = fixture({
    'border.dfn':
      'use "./t-shirt.dfn"\n\nborder-scale = <@t-shirt [sm, md]>\nroot = border.<border-scale>\n',
    't-shirt.dfn': 'size = sm | md | lg\nscale = 1 | 2\n',
  });
  const diagnostics = lintModule(join(dir, 'border.dfn'));
  expect(diagnostics).toHaveLength(1);
  expect(diagnostics[0].file).toBe(join(dir, 'border.dfn'));
  expect(diagnostics[0].line).toBe(3);
  expect(diagnostics[0].column).toBe(16);
  expect(diagnostics[0].message).toBe(
    "'t-shirt' is imported, but it declares no root (a fragment) — reference one of its productions: <@t-shirt/size>, <@t-shirt/scale>",
  );
});

test('a qualified miss lists what the import declares', () => {
  const dir = fixture({
    'border.dfn': 'use "./t-shirt.dfn"\n\nroot = border.<@t-shirt/sizes>\n',
    't-shirt.dfn': 'size = sm | md | lg\n',
  });
  const diagnostics = lintModule(join(dir, 'border.dfn'));
  expect(diagnostics[0].message).toBe(
    "'t-shirt' has no production 'sizes' — it declares: <@t-shirt/size>",
  );
});
