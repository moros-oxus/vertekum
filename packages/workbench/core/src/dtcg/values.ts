import { DTCG_TOKEN_SCHEMA } from '../validate/dtcg-schema';

/**
 * Value notation codecs: short form in, spec form stored, CSS out.
 *
 * `parseValueInput` turns author-ergonomic strings (`#ff00ff`, `4px`, `200ms`) into the 2025.10
 * value objects, keyed by the token's EFFECTIVE type — only `color`, `dimension` and `duration`
 * transform; every other type is already spec-true as written. `renderCssValue` is the reverse
 * edge for exporters: spec object → CSS string, shape-dispatched (spec objects self-identify),
 * synchronous and dependency-free — stored values need formatting, not conversion.
 *
 * Colour conversion is culori's, imported DYNAMICALLY inside the functions that convert — the ajv
 * pattern: core's main entry is bundled into the browser app, and the library must never enter
 * that module graph. It loads only when a verb, `migrate values`, or an export-side conversion
 * actually runs.
 */

/** The spec's colour spaces, read from the bundled format schema rather than retyped. */
export const COLOR_SPACES: readonly string[] = (() => {
  const definitions = (DTCG_TOKEN_SCHEMA as Record<string, unknown>)
    .definitions as Record<string, unknown>;
  const color = definitions[
    'https://www.designtokens.org/schemas/2025.10/format/values/color.json'
  ] as {
    properties: {
      colorSpace: { enum?: string[]; oneOf?: { enum?: string[] }[] };
    };
  };
  const spaces =
    color.properties.colorSpace.enum ??
    color.properties.colorSpace.oneOf?.find((entry) => entry.enum)?.enum;
  if (!spaces)
    throw new Error('colorSpace enum not found in the format schema');
  return spaces;
})();

/** spec colorSpace → culori mode, and the channel order `components` uses. */
const SPACES: Record<string, { mode: string; channels: string[] }> = {
  srgb: { mode: 'rgb', channels: ['r', 'g', 'b'] },
  'srgb-linear': { mode: 'lrgb', channels: ['r', 'g', 'b'] },
  hsl: { mode: 'hsl', channels: ['h', 's', 'l'] },
  hwb: { mode: 'hwb', channels: ['h', 'w', 'b'] },
  lab: { mode: 'lab', channels: ['l', 'a', 'b'] },
  lch: { mode: 'lch', channels: ['l', 'c', 'h'] },
  oklab: { mode: 'oklab', channels: ['l', 'a', 'b'] },
  oklch: { mode: 'oklch', channels: ['l', 'c', 'h'] },
  'display-p3': { mode: 'p3', channels: ['r', 'g', 'b'] },
  'a98-rgb': { mode: 'a98', channels: ['r', 'g', 'b'] },
  'prophoto-rgb': { mode: 'prophoto', channels: ['r', 'g', 'b'] },
  rec2020: { mode: 'rec2020', channels: ['r', 'g', 'b'] },
  'xyz-d65': { mode: 'xyz65', channels: ['x', 'y', 'z'] },
  'xyz-d50': { mode: 'xyz50', channels: ['x', 'y', 'z'] },
};

/** Half-up to 4 decimals, trailing zeros dropped — same input, same bytes, byte-stable diffs. */
function round4(n: number): number {
  return Number(n.toFixed(4));
}

export interface ColorValue {
  colorSpace: string;
  components: number[];
  alpha: number;
  hex: string;
}

function isColorValue(value: unknown): value is ColorValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ColorValue).colorSpace === 'string' &&
    Array.isArray((value as ColorValue).components)
  );
}

/** Build the spec colour object from a culori colour, in `space`. */
function toSpecColor(
  culori: typeof import('culori'),
  parsed: object,
  space: string,
): ColorValue {
  const target = SPACES[space];
  if (!target) throw new Error(`unknown colorSpace '${space}'`);
  const converted = culori.converter(target.mode as 'rgb')(
    parsed as never,
  ) as unknown as Record<string, number>;
  // Gamut-bounded spaces clamp to [0,1]: converting ROUNDED storage back and forth leaves a
  // deterministic ±1e-4 drift, and -0.0001 or 1.0001 are not colours.
  const bounded = new Set(['rgb', 'lrgb', 'p3', 'a98', 'prophoto', 'rec2020']);
  const clamp = bounded.has(target.mode)
    ? (n: number) => Math.min(1, Math.max(0, n))
    : (n: number) => n;
  return {
    colorSpace: space,
    // an achromatic colour has an undefined hue channel; 0 is its canonical spelling
    components: target.channels.map((channel) =>
      round4(clamp(converted[channel] ?? 0)),
    ),
    alpha: converted.alpha ?? 1,
    hex: (culori.formatHex(parsed as never) ?? '#000000').toLowerCase(),
  };
}

const DIMENSION = /^(-?(?:\d+\.?\d*|\.\d+))(px|rem)$/;
const DURATION = /^(-?(?:\d+\.?\d*|\.\d+))(ms|s)$/;

/**
 * Author input → spec value object, by effective type.
 *
 * `undefined` means "no transform produced": for `color`/`dimension`/`duration` the caller should
 * treat that as unparseable input; for any other type it means "no codec — the raw value is
 * already the spec form". References and JSON objects never reach this function — callers guard.
 */
export async function parseValueInput(
  type: string,
  raw: string,
  options?: { colorSpace?: string },
): Promise<unknown | undefined> {
  if (type === 'dimension') {
    const match = DIMENSION.exec(raw.trim());
    return match ? { value: Number(match[1]), unit: match[2] } : undefined;
  }
  if (type === 'duration') {
    const match = DURATION.exec(raw.trim());
    return match ? { value: Number(match[1]), unit: match[2] } : undefined;
  }
  if (type !== 'color') return undefined;

  const culori = await import('culori');
  const parsed = culori.parse(raw.trim());
  if (!parsed) return undefined;
  return toSpecColor(culori, parsed as object, options?.colorSpace ?? 'oklch');
}

/**
 * Move a stored colour object to another space — the export-side counterpart of `parseValueInput`,
 * for targets that deliver in a different space than the author stores.
 */
export async function convertColor(
  value: unknown,
  targetSpace: string,
): Promise<unknown> {
  if (!isColorValue(value) || value.colorSpace === targetSpace) return value;
  const source = SPACES[value.colorSpace];
  if (!source) return value;

  const culori = await import('culori');
  const color: Record<string, number | string> = { mode: source.mode };
  source.channels.forEach((channel, index) => {
    color[channel] = value.components[index] ?? 0;
  });
  if (value.alpha !== 1) color.alpha = value.alpha;
  return toSpecColor(culori, color as object, targetSpace);
}

/** Spaces CSS names as functions; everything else renders through `color(<space> …)`. */
const CSS_FUNCTIONS = new Set(['oklch', 'oklab', 'lab', 'lch']);

/**
 * Spec value object → CSS string. Shape-dispatched: spec objects self-identify (`colorSpace` ⇒
 * colour; `{value, unit}` ⇒ dimension/duration). `undefined` = not a known spec shape — callers
 * keep their existing fallback.
 */
export function renderCssValue(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined;

  if (isColorValue(value)) {
    const alpha =
      value.alpha !== undefined && value.alpha !== 1 ? ` / ${value.alpha}` : '';
    const [a = 0, b = 0, c = 0] = value.components;
    if (CSS_FUNCTIONS.has(value.colorSpace)) {
      return `${value.colorSpace}(${a} ${b} ${c}${alpha})`;
    }
    if (value.colorSpace === 'hsl' || value.colorSpace === 'hwb') {
      // culori carries these channels as 0–1; CSS wants percentages
      return `${value.colorSpace}(${a} ${round4(b * 100)}% ${round4(c * 100)}%${alpha})`;
    }
    return `color(${value.colorSpace} ${a} ${b} ${c}${alpha})`;
  }

  const unit = (value as { unit?: string }).unit;
  const amount = (value as { value?: number }).value;
  if (typeof amount === 'number' && typeof unit === 'string') {
    if (['px', 'rem', 'ms', 's'].includes(unit)) return `${amount}${unit}`;
  }
  return undefined;
}

/** Hex from components — always computed, never trusted from storage. Hex IS sRGB. */
export async function renderHex(value: unknown): Promise<string | undefined> {
  if (!isColorValue(value)) return undefined;
  const srgb = (await convertColor(value, 'srgb')) as ColorValue;
  const byte = (n: number) =>
    Math.round(Math.min(1, Math.max(0, n)) * 255)
      .toString(16)
      .padStart(2, '0');
  const [r = 0, g = 0, b = 0] = srgb.components;
  const alpha =
    srgb.alpha !== undefined && srgb.alpha !== 1 ? byte(srgb.alpha / 1) : '';
  return `#${byte(r)}${byte(g)}${byte(b)}${alpha}`;
}
