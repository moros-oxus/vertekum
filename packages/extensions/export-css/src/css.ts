import { dtcg, type Exporter, type Token } from '@vertekum/core';
import { z } from 'zod';

/**
 * A token's path as a CSS custom-property name: `color.brand.primary` → `--color-brand-primary`.
 *
 * `$root` is dropped, so a group's own value exports under the group's name — `color.text.$root`
 * becomes `--color-text`. It is DTCG's way of saying "this group has a value", not part of the name.
 */
function cssVar(token: Token): string {
  return `--${dtcg.tokens.exportPath(token.path).join('-')}`;
}

/**
 * A resolved value as CSS: a DTCG reference → `var(--dashed-path)`; a spec value object → its CSS
 * form (`oklch(…)`, `4px` — or `#rrggbb` under `colorFormat: 'hex'`, computed from components,
 * never trusted from storage); anything else the literal, as before.
 *
 * The same `$root` rule has to apply here, or `{color.text.$root}` would emit a `var()` pointing at
 * a custom property that `cssVar` never declared.
 */
function renderValue(value: unknown, colorFormat: 'css' | 'hex'): string {
  if (dtcg.tokens.isReference(value)) {
    const path = dtcg.tokens.exportPath(
      dtcg.tokens.referenceToPath(value).split('.'),
    );
    return `var(--${path.join('-')})`;
  }
  if (colorFormat === 'hex') {
    const color = value as {
      colorSpace?: string;
      components?: number[];
      alpha?: number;
    };
    if (color?.colorSpace === 'srgb' && Array.isArray(color.components)) {
      // the conversion pass has already brought every colour to srgb — hex IS srgb
      const byte = (n: number) =>
        Math.round(Math.min(1, Math.max(0, n)) * 255)
          .toString(16)
          .padStart(2, '0');
      const [r = 0, g = 0, b = 0] = color.components;
      const alpha =
        color.alpha !== undefined && color.alpha !== 1 ? byte(color.alpha) : '';
      return `#${byte(r)}${byte(g)}${byte(b)}${alpha}`;
    }
  }
  return dtcg.values.render(value) ?? String(value);
}

function block(selector: string, decls: string[]): string {
  return `${selector} {\n${decls.map((d) => `\t${d}`).join('\n')}\n}\n`;
}

/** Declarations in a variant that differ from base — the only ones a variant block needs. */
function diffDecls(
  base: Token[],
  tokens: Token[],
  colorFormat: 'css' | 'hex',
): string[] {
  const baseByPath = new Map(
    base.map((t) => [t.path.join('.'), JSON.stringify(t.value)]),
  );
  const decls: string[] = [];
  for (const token of tokens) {
    const key = token.path.join('.');
    // Structural comparison: value objects are equal by CONTENT — identity comparison would list
    // every object-valued token in every variant block.
    if (
      !baseByPath.has(key) ||
      baseByPath.get(key) !== JSON.stringify(token.value)
    ) {
      decls.push(`${cssVar(token)}: ${renderValue(token.value, colorFormat)};`);
    }
  }
  return decls;
}

/** Contexts that map to a `prefers-color-scheme` query; anything else has no media equivalent. */
const MEDIA_CONTEXTS = new Set(['light', 'dark']);

/**
 * How variant blocks are emitted: attribute selectors (default), `prefers-color-scheme` media
 * queries, or one file per variant. Declared to the registry so `check` validates a target's
 * options and `describe` publishes them (ADR-0029).
 */
export const CssOptions = z.object({
  selector: z
    .enum(['attribute', 'media', 'files'])
    .default('attribute')
    .describe(
      'How variants are emitted: `attribute` → [data-modifier="context"] blocks; `media` → prefers-color-scheme queries for light/dark; `files` → one file per variant',
    ),
  fileName: z
    .string()
    .default('tokens.css')
    .describe(
      'Name of the emitted stylesheet, relative to the target `out` dir',
    ),
  colorSpace: z
    .enum(dtcg.values.COLOR_SPACES as [string, ...string[]])
    .default('oklch')
    .describe(
      'Colour space this target EMITS. Fixed default \'oklch\' — deliberately not "the stored space", so delivery stays consistent when storage changes',
    ),
  colorFormat: z
    .enum(['css', 'hex'])
    .default('css')
    .describe(
      'css → the function form (oklch(…), color(display-p3 …)); hex → #rrggbb(aa) computed from components. Hex IS sRGB, so it implies srgb conversion',
    ),
});
export type CssOptions = z.infer<typeof CssOptions>;

/** Built-in exporter: CSS custom properties. Variant emission follows `options.selector`. */
export const cssExporter: Exporter = {
  id: 'css',
  name: 'CSS Custom Properties',
  optionsSchema: CssOptions,
  transform: async (input) => {
    const { selector, fileName, colorSpace, colorFormat } = CssOptions.parse(
      input.options ?? {},
    );

    // Colours are DELIVERED in one space per target, whatever the storage space. Hex is sRGB by
    // definition, so it overrides the space. Conversion (culori, dynamically imported inside
    // convertColor) runs only for values not already in the effective target.
    const target = colorFormat === 'hex' ? 'srgb' : colorSpace;
    const converted = async (tokens: Token[]) =>
      Promise.all(
        tokens.map(async (token) => ({
          ...token,
          value: await dtcg.values.convertColor(token.value, target),
        })),
      );
    const base = await converted(input.base);
    const variants = await Promise.all(
      input.variants.map(async (v) => ({
        ...v,
        tokens: await converted(v.tokens),
      })),
    );

    const root = block(
      ':root',
      base.map((t) => `${cssVar(t)}: ${renderValue(t.value, colorFormat)};`),
    );

    if (selector === 'files') {
      return [
        { path: fileName, content: root },
        ...variants.map((v) => ({
          path: `${v.modifier}-${v.context}.${fileName}`,
          content: block(':root', diffDecls(base, v.tokens, colorFormat)),
        })),
      ];
    }

    const blocks = variants.map((v) => {
      const decls = diffDecls(base, v.tokens, colorFormat);
      if (selector === 'media' && MEDIA_CONTEXTS.has(v.context)) {
        const inner = block(':root', decls)
          .split('\n')
          .map((line) => (line ? `\t${line}` : line))
          .join('\n');
        return `@media (prefers-color-scheme: ${v.context}) {\n${inner}}\n`;
      }
      return block(`[data-${v.modifier}="${v.context}"]`, decls);
    });

    return [{ path: fileName, content: [root, ...blocks].join('\n') }];
  },
};
