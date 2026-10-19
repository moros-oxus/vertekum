import { evaluateScale } from '@vertekum/core';
import {
  clampChroma,
  converter,
  formatHex,
  oklch,
  parse as parseColor,
} from 'culori';

/**
 * The ramp model — one brand anchor, a shared lightness ladder, chroma arched through the anchor.
 *
 * In OKLCH terms, for a ramp of N steps:
 *
 * - **L (lightness)** comes from the ladder: an explicit per-step table when configured, else a
 *   curve from `lightness.first` to `lightness.last` (`L = first + (last − first) · t^ease`).
 *   The step number is therefore a lightness — a contrast duty — never a measure of saturation.
 * - **The anchor is kept, never repainted.** It lands on the step whose ladder L is nearest its
 *   own L, and that step carries the anchor itself: the reference when the anchor is authored as
 *   one (`{color.brand.teal}` — the step is an alias to the named colour, so exporters keep the
 *   link), else the colour exactly (its own L, C, h, hex). The ladder only positions it.
 * - **C (chroma)** arches through the anchor:
 *   lighter · `C = Cₐ · ((1−L)/(1−Lₐ))^kl`, with `kl = ln(lightFraction) / ln((1−L_first)/(1−Lₐ))`
 *   — solved so the palest step is always `lightFraction × Cₐ`, wherever the anchor landed;
 *   darker · `C = Cₐ · (L/Lₐ)^darkExponent`.
 * - **h (hue)** is held. With `hueDrift`, steps darker than the anchor rotate linearly, reaching
 *   `hₐ + hueDrift` at the last step (deep yellows drift toward orange instead of going olive).
 */

/** The `$extensions` key this extension owns — the first-party generator family. */
export const RAMP_KEY = 'org.vertekum.generate/ramp';

/**
 * The mark `ramp build` puts on every stop it writes (`$extensions[RAMP_KEY]` on the stop). On disk
 * a committed stop and an authored override are both real children; the mark is how a later build
 * knows which ones it owns. An unmarked child is an override.
 */
export const COMMITTED = 'committed';

/**
 * The gamut a computed stop is mapped into.
 *
 * `'none'` stores the arch's own chroma whatever it lands on — the behaviour before mapping
 * existed, kept as a deliberate escape hatch rather than a migration aid.
 */
export type RampGamut = 'srgb' | 'display-p3' | 'none';

/**
 * Culori spells display-p3 `p3`, and THROWS on a name it does not know rather than passing the
 * colour through unmapped. So the public name is translated explicitly: a pass-through would
 * turn `'display-p3'` into a runtime error on every ramp that asked for it.
 */
/** culori's own names for the RGB gamuts it can clamp into. */
const CULORI_GAMUT: Record<Exclude<RampGamut, 'none'>, 'rgb' | 'p3'> = {
  srgb: 'rgb',
  'display-p3': 'p3',
};

export interface RampPhysics {
  /** L endpoints + curve for ANY ramp length. `ease: 1` = evenly spaced. */
  lightness: { first: number; last: number; ease: number };
  /** Explicit per-step L table; WINS over the curve for the steps it names. */
  ladder?: Record<string, number>;
  /** C(first) = lightFraction × C(anchor). */
  lightFraction: number;
  /** The dark-side chroma exponent. */
  darkExponent: number;
  /**
   * The gamut every COMPUTED stop is mapped into; absent is `'srgb'`. Mapping holds L and h and
   * reduces C to the gamut boundary — a generated value the target cannot represent is an
   * artifact, not a colour. The ANCHOR's step is never mapped: it carries the anchor as
   * authored (its reference, or its colour verbatim), which is the model's promise.
   */
  gamut?: RampGamut;
}

export const DEFAULT_PHYSICS: RampPhysics = {
  lightness: { first: 0.958, last: 0.27, ease: 1 },
  lightFraction: 0.2,
  darkExponent: 0.85,
  gamut: 'srgb',
};

/**
 * How an alpha stop is made:
 * - `solid` — the solid stop's colour at the step's opacity;
 * - `anchor` — the anchor's colour at the step's opacity;
 * - `match` — the translucent colour that, laid over `background`, looks like the solid stop.
 */
export type AlphaMode = 'solid' | 'anchor' | 'match';

/** The alpha series, resolved: an `A`-prefixed translucent twin of every step. */
export interface RampAlpha {
  mode: AlphaMode;
  /** Prepended to each step name (`A100`); a word fragment, as in the dfn affix grammar. */
  prefix: string;
  /** The opacity curve, first step to last (`solid`/`anchor`). */
  opacity: { first: number; last: number; ease: number };
  /** Explicit per-step opacity; WINS over the curve for the steps it names. */
  ladder?: Record<string, number>;
  /** The surface `match` composites over — a colour or a reference. */
  background?: unknown;
}

/** A partial of the alpha fields — settings, a profile, or a payload. */
export type RampAlphaSettings = Partial<Omit<RampAlpha, 'opacity'>> & {
  opacity?: Partial<RampAlpha['opacity']>;
};

export const DEFAULT_ALPHA: RampAlpha = {
  mode: 'solid',
  prefix: 'A',
  opacity: { first: 0.05, last: 0.9, ease: 1 },
};

/** A named partial of the physics — a brand's ladder, a tweaked curve. */
export interface RampProfile {
  lightness?: Partial<RampPhysics['lightness']>;
  ladder?: Record<string, number>;
  lightFraction?: number;
  darkExponent?: number;
  gamut?: RampGamut;
  alpha?: RampAlphaSettings;
}

/** The configured physics: the project-wide base plus named profiles. */
export interface RampConfig extends RampPhysics {
  profiles?: Record<string, RampProfile>;
  /** The profile a payload without `profile` uses. */
  defaultProfile?: string;
  /** Alpha defaults. They never turn the series on — only a payload's `alpha` does. */
  alpha?: RampAlphaSettings;
}

export interface RampPayload {
  /** A colour (hex or stored object) or a reference (`"{brand.accent}"`). */
  anchor: unknown;
  /** Step names, in the dfn range grammar: `"100-1000/100"`, `"050-500/50"`. */
  scalar: string;
  /** Degrees of dark-side hue rotation, reached at the last step. Default 0 (hue held). */
  hueDrift?: number;
  /** A named physics profile from settings; absent → `defaultProfile` → the base alone. */
  profile?: string;
  /** Per-ramp overrides of the configured physics. */
  ladder?: Record<string, number>;
  lightness?: Partial<RampPhysics['lightness']>;
  lightFraction?: number;
  darkExponent?: number;
  gamut?: RampGamut;
  /** The alpha series: `true` with the configured defaults, an object to override them. */
  alpha?: true | RampAlphaSettings;
}

/**
 * A stored DTCG colour value in oklch notation — every stop, a `match` twin included (it is
 * solved in an RGB space and stored back in oklch).
 */
export interface RampStop {
  colorSpace: 'oklch';
  components: [number, number, number];
  alpha: number;
  hex: string;
}

/**
 * An alpha stop that borrows another token's colour by value-position JSON Pointer (DTCG 2025.10)
 * and states only its own opacity — the link survives in the tokens.
 */
export interface RampPointerStop {
  colorSpace: { $ref: string };
  components: { $ref: string };
  alpha: number;
}

/** One computed stop: a colour, a pointer-linked colour, or the anchor's reference. */
export type RampValue = RampStop | RampPointerStop | string;

/** Why the alpha series could not compute — the solid series is unaffected. */
export interface RampAlphaError {
  code:
    | 'ramp/missing-background'
    | 'ramp/unresolved-background'
    | 'ramp/alpha-gamut';
  message: string;
}

const SCALAR = /^(\d+)-(\d+)\/(\d+)$/;

/** Parse the stepped range grammar (`min-max/step`, leading zeros set the pad). */
export function parseScalar(
  scalar: string,
): { names: string[] } | { error: string } {
  const match = SCALAR.exec(scalar);
  if (!match) {
    return {
      error: `scalar '${scalar}' is not a stepped range — expected 'min-max/step', e.g. '100-1000/100'`,
    };
  }
  const [, min, max, step] = match as unknown as [
    string,
    string,
    string,
    string,
  ];
  const result = evaluateScale({
    kind: 'stepped',
    min: Number(min),
    max: Number(max),
    step: Number(step),
    ...(min.startsWith('0') ? { pad: min.length } : {}),
  });
  if (result.names.length < 2) {
    return { error: `scalar '${scalar}' yields fewer than two steps` };
  }
  return { names: result.names };
}

const round = (value: number, places: number): number => {
  const f = 10 ** places;
  return Math.round(value * f) / f;
};

/**
 * Rounding TOWARD ZERO, for the one value that must never grow: a gamut-mapped chroma sits
 * exactly on the boundary, so rounding it up in the fourth decimal puts the stop back outside
 * the gamut it was just mapped into.
 */
const floorTo = (value: number, places: number): number => {
  const f = 10 ** places;
  return Math.floor(value * f) / f;
};

/**
 * Resolve one ramp's effective physics through the four-layer chain, per field:
 * built-in defaults ← top-level settings ← selected profile ← payload overrides.
 * `ladder` tables merge BY STEP KEY through the chain; `lightness` merges per-field; scalars
 * replace. The selected profile is `payload.profile`, else `defaultProfile`, else none — and an
 * unknown name is an ERROR, never a silent fallback.
 */
export function physicsFor(
  config: RampConfig,
  payload: RampPayload,
): RampPhysics | { error: string } {
  const profile = profileFor(config, payload);
  if ('error' in profile) return profile;
  return {
    lightness: {
      ...config.lightness,
      ...(profile.lightness ?? {}),
      ...(payload.lightness ?? {}),
    },
    ladder: {
      ...(config.ladder ?? {}),
      ...(profile.ladder ?? {}),
      ...(payload.ladder ?? {}),
    },
    lightFraction:
      payload.lightFraction ?? profile.lightFraction ?? config.lightFraction,
    darkExponent:
      payload.darkExponent ?? profile.darkExponent ?? config.darkExponent,
    // A scalar: it REPLACES through the chain rather than merging, like lightFraction.
    gamut: payload.gamut ?? profile.gamut ?? config.gamut,
  };
}

/** The selected profile: `payload.profile`, else `defaultProfile`, else none; unknown → error. */
function profileFor(
  config: RampConfig,
  payload: RampPayload,
): RampProfile | { error: string } {
  const name = payload.profile ?? config.defaultProfile;
  if (name === undefined) return {};
  const held = config.profiles?.[name];
  if (held) return held;
  const defined = Object.keys(config.profiles ?? {});
  return {
    error: `unknown profile '${name}' — defined: ${defined.join(', ') || '(none)'}`,
  };
}

/**
 * The payload's alpha series through the same four layers as the physics — built-in defaults ←
 * settings ← profile ← payload — `ladder` merging by step key, `opacity` per field, the rest
 * replacing. Undefined when the payload does not turn the series on: settings and profiles only
 * supply defaults.
 */
export function alphaFor(
  config: RampConfig,
  payload: RampPayload,
): RampAlpha | undefined | { error: string } {
  if (payload.alpha === undefined) return undefined;
  const profile = profileFor(config, payload);
  if ('error' in profile) return profile;
  const layers = [
    config.alpha ?? {},
    profile.alpha ?? {},
    payload.alpha === true ? {} : payload.alpha,
  ];
  const resolved: RampAlpha = {
    ...DEFAULT_ALPHA,
    opacity: { ...DEFAULT_ALPHA.opacity },
  };
  for (const layer of layers) {
    const { opacity, ladder, ...rest } = layer;
    Object.assign(resolved, rest);
    if (opacity) resolved.opacity = { ...resolved.opacity, ...opacity };
    if (ladder) resolved.ladder = { ...(resolved.ladder ?? {}), ...ladder };
  }
  return resolved;
}

/** Every stop name a payload yields: the solid steps, then the alpha twins when the series is on. */
export function stopNames(payload: RampPayload, config: RampConfig): string[] {
  const scale = parseScalar(payload.scalar);
  if ('error' in scale) return [];
  const alpha = alphaFor(config, payload);
  const prefixed =
    alpha && !('error' in alpha)
      ? scale.names.map((name) => `${alpha.prefix}${name}`)
      : [];
  return [...scale.names, ...prefixed];
}

/** The resolved anchor as OKLCH + its verbatim stored form; null when it is not a colour. */
export function anchorOf(
  value: unknown,
): { l: number; c: number; h: number; stop: RampStop } | null {
  let raw: string | undefined;
  if (typeof value === 'string') raw = value;
  else if (value && typeof value === 'object') {
    const object = value as {
      colorSpace?: unknown;
      components?: unknown;
      alpha?: unknown;
      hex?: unknown;
    };
    if (
      object.colorSpace === 'oklch' &&
      Array.isArray(object.components) &&
      object.components.length === 3
    ) {
      const [l, c, h] = object.components as [number, number, number];
      const hex =
        typeof object.hex === 'string'
          ? object.hex
          : formatHex({ mode: 'oklch', l, c, h });
      return {
        l,
        c,
        h,
        stop: {
          colorSpace: 'oklch',
          components: [l, c, h],
          alpha: typeof object.alpha === 'number' ? object.alpha : 1,
          hex,
        },
      };
    }
    if (typeof object.hex === 'string') raw = object.hex;
  }
  if (raw === undefined) return null;
  const parsed = parseColor(raw);
  if (!parsed) return null;
  const ok = oklch(parsed);
  const l = ok.l ?? 0;
  const c = ok.c ?? 0;
  const h = ok.h ?? 0;
  return {
    l,
    c,
    h,
    stop: {
      colorSpace: 'oklch',
      components: [round(l, 4), round(c, 4), round(h, 1)],
      alpha: ok.alpha ?? 1,
      hex: raw.startsWith('#') ? raw.toUpperCase() : formatHex(ok),
    },
  };
}

/** A curly reference (`{color.brand.teal}`) — the only anchor form a step can alias. */
const isReference = (value: unknown): value is string =>
  typeof value === 'string' && /^\{[^}]+\}$/.test(value);

/**
 * What `computeRamp` needs from the collection beyond the anchor: the resolved `alpha.background`
 * (for `match`), and the path of the token holding the anchor's colour — the end of its alias
 * chain, which a pointer-linked alpha stop addresses.
 */
export interface RampContext {
  background?: unknown;
  anchorTarget?: string[];
}

/**
 * Compute a whole ramp: step name → stored colour value. The anchor step carries the anchor as
 * authored — its reference when it is one, else its colour verbatim; every other step is
 * calculated from the RESOLVED anchor. When the payload turns `alpha` on, the alpha twins follow
 * the solid steps. Returns an error string instead when the payload cannot compute (bad scalar,
 * non-colour anchor); an alpha series that cannot compute is reported as `alphaError` beside the
 * solid stops, never in their place.
 */
export function computeRamp(
  payload: RampPayload,
  config: RampConfig,
  resolvedAnchor: unknown,
  context: RampContext = {},
):
  | { stops: Record<string, RampValue>; alphaError?: RampAlphaError }
  | { error: string } {
  const scale = parseScalar(payload.scalar);
  if ('error' in scale) return scale;
  const physics = physicsFor(config, payload);
  if ('error' in physics) return physics;
  const anchor = anchorOf(resolvedAnchor);
  if (!anchor) {
    return {
      error: `anchor does not resolve to a colour (got ${JSON.stringify(resolvedAnchor) ?? 'nothing'})`,
    };
  }

  const { names } = scale;
  const n = names.length;
  const ladderL = names.map((name, index) => {
    const explicit = physics.ladder?.[name];
    if (typeof explicit === 'number') return explicit;
    const t = n === 1 ? 0 : index / (n - 1);
    const { first, last, ease } = physics.lightness;
    return first + (last - first) * t ** ease;
  });

  // The anchor lands on the step whose ladder L is nearest its own.
  let anchorIndex = 0;
  for (let i = 1; i < n; i++) {
    if (
      Math.abs((ladderL[i] as number) - anchor.l) <
      Math.abs((ladderL[anchorIndex] as number) - anchor.l)
    ) {
      anchorIndex = i;
    }
  }

  const firstL = ladderL[0] as number;
  // Solved so C(first) = lightFraction × Cₐ regardless of where the anchor landed.
  const kl =
    anchor.l >= 1 || firstL >= 1
      ? 1
      : Math.log(physics.lightFraction) /
        Math.log((1 - firstL) / (1 - anchor.l));

  const drift = payload.hueDrift ?? 0;
  const gamut = physics.gamut ?? 'srgb';
  const out: Record<string, RampValue> = {};
  names.forEach((name, index) => {
    if (index === anchorIndex) {
      out[name] = isReference(payload.anchor) ? payload.anchor : anchor.stop;
      return;
    }
    const L = ladderL[index] as number;
    const lighter = index < anchorIndex;
    const c = lighter
      ? anchor.c * ((1 - L) / (1 - anchor.l)) ** kl
      : anchor.c * (L / anchor.l) ** physics.darkExponent;
    const h =
      !lighter && drift !== 0 && n - 1 > anchorIndex
        ? anchor.h + drift * ((index - anchorIndex) / (n - 1 - anchorIndex))
        : anchor.h;

    // Lightness and hue are rounded BEFORE mapping, so the gamut check sees the values that
    // will actually be stored. Mapping first and rounding afterwards lands the colour exactly
    // ON the boundary and then nudges it back outside in the fourth decimal — the original bug
    // again, three orders of magnitude smaller and just as real.
    const storedL = round(L, 4);
    const storedH = round(((h % 360) + 360) % 360, 1);

    // Chroma alone is reduced, and floored rather than rounded — see floorTo. This is NOT
    // formatHex's per-channel RGB clip, which shifts hue and lightness as a side effect of
    // clamping channels independently: the reason hex and components used to disagree.
    const storedC =
      gamut === 'none'
        ? round(c, 4)
        : floorTo(
            clampChroma(
              { mode: 'oklch' as const, l: storedL, c, h: storedH },
              'oklch',
              CULORI_GAMUT[gamut],
            ).c ?? c,
            4,
          );

    out[name] = {
      colorSpace: 'oklch',
      components: [storedL, storedC, storedH],
      alpha: 1,
      // Derived from the STORED triple, so the hex and the components are one colour.
      hex: formatHex({
        mode: 'oklch',
        l: storedL,
        c: storedC,
        h: storedH,
      }).toUpperCase(),
    };
  });

  const alpha = alphaFor(config, payload);
  if (!alpha || 'error' in alpha) return { stops: out };
  // The solid colour each alpha twin derives from: the computed stop, or the anchor's colour on
  // its own step (whose solid value may be a reference).
  const solidAt = (index: number): RampStop =>
    index === anchorIndex
      ? anchor.stop
      : (out[names[index] as string] as RampStop);
  const series = alphaSeries({
    names,
    alpha,
    gamut,
    solidAt,
    anchorIndex,
    anchorStop: anchor.stop,
    // A pointer can only borrow members that exist: the anchor must be a reference whose chain
    // ends on a stored colour OBJECT (a legacy hex string has no `components` to point into).
    pointerTo:
      isReference(payload.anchor) &&
      context.anchorTarget &&
      isColourObject(resolvedAnchor)
        ? context.anchorTarget
        : undefined,
    // A literal background needs no resolving; a reference needs the caller's resolution.
    background:
      context.background ??
      (isReference(alpha.background) ? undefined : alpha.background),
  });
  if ('alphaError' in series) return { stops: out, ...series };
  return { stops: { ...out, ...series.stops } };
}

/** A stored DTCG colour object — the shape a pointer can address `colorSpace`/`components` in. */
function isColourObject(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const object = value as { colorSpace?: unknown; components?: unknown };
  return (
    typeof object.colorSpace === 'string' && Array.isArray(object.components)
  );
}

/** The DTCG colour spaces a ramp reads: its own oklch stops, and an authored background's. */
type ReadSpace = 'oklch' | 'srgb' | 'display-p3';

/** culori's view of a stored colour. */
function culoriOf(stop: {
  colorSpace: ReadSpace;
  components: [number, number, number];
}) {
  const [a, b, c] = stop.components;
  if (stop.colorSpace === 'srgb')
    return { mode: 'rgb' as const, r: a, g: b, b: c };
  if (stop.colorSpace === 'display-p3') {
    return { mode: 'p3' as const, r: a, g: b, b: c };
  }
  return { mode: 'oklch' as const, l: a, c: b, h: c };
}

/** A background as authored or resolved — hex, or a stored colour — in culori form, with alpha. */
function backgroundOf(value: unknown) {
  if (typeof value === 'string') return parseColor(value);
  if (!value || typeof value !== 'object') return undefined;
  const object = value as {
    colorSpace?: unknown;
    components?: unknown;
    alpha?: unknown;
    hex?: unknown;
  };
  if (
    (object.colorSpace === 'oklch' ||
      object.colorSpace === 'srgb' ||
      object.colorSpace === 'display-p3') &&
    Array.isArray(object.components) &&
    object.components.length === 3
  ) {
    return {
      ...culoriOf({
        colorSpace: object.colorSpace,
        components: object.components as [number, number, number],
      }),
      alpha: typeof object.alpha === 'number' ? object.alpha : 1,
    };
  }
  return typeof object.hex === 'string' ? parseColor(object.hex) : undefined;
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/** Round UP — the one rounding that keeps a matched colour inside the unit cube. */
const ceilTo = (value: number, places: number): number => {
  const f = 10 ** places;
  return Math.ceil(value * f - 1e-9) / f;
};

/**
 * Solve "which translucent colour, laid over `background`, looks like `target`?" per channel in
 * one RGB space. The opacity is the smallest that can reach the target from the background —
 * `a = maxₖ (Tₖ > Bₖ ? (Tₖ−Bₖ)/(1−Bₖ) : Tₖ < Bₖ ? (Bₖ−Tₖ)/Bₖ : 0)`, rounded up — and the colour
 * is `Cₖ = Bₖ + (Tₖ−Bₖ)/a`, so `a·C + (1−a)·B = T`. Equal colours need no opacity at all.
 */
export function matchOver(
  target: [number, number, number],
  background: [number, number, number],
): { components: [number, number, number]; alpha: number } {
  let needed = 0;
  target.forEach((t, k) => {
    const b = background[k] as number;
    const reach = t > b ? (t - b) / (1 - b) : t < b ? (b - t) / b : 0;
    needed = Math.max(needed, reach);
  });
  const alpha = Math.min(1, ceilTo(needed, 3));
  if (alpha === 0) return { components: [...background], alpha: 0 };
  const components = target.map((t, k) => {
    const b = background[k] as number;
    return round(clamp01(b + (t - b) / alpha), 4);
  }) as [number, number, number];
  return { components, alpha };
}

/** The alpha twins of a computed ramp, by mode; an error when they cannot compute. */
function alphaSeries(input: {
  names: string[];
  alpha: RampAlpha;
  gamut: RampGamut;
  solidAt: (index: number) => RampStop;
  anchorIndex: number;
  anchorStop: RampStop;
  pointerTo?: string[];
  background: unknown;
}):
  | { stops: Record<string, RampStop | RampPointerStop> }
  | { alphaError: RampAlphaError } {
  const { names, alpha, gamut } = input;
  const n = names.length;
  const opacityAt = (index: number): number => {
    const explicit = alpha.ladder?.[names[index] as string];
    if (typeof explicit === 'number') return explicit;
    const t = n === 1 ? 0 : index / (n - 1);
    const { first, last, ease } = alpha.opacity;
    return round(first + (last - first) * t ** ease, 3);
  };
  const pointer = (opacity: number): RampPointerStop | undefined => {
    if (!input.pointerTo) return undefined;
    const at = `#/${input.pointerTo.join('/')}/$value`;
    return {
      colorSpace: { $ref: `${at}/colorSpace` },
      components: { $ref: `${at}/components` },
      alpha: opacity,
    };
  };

  const out: Record<string, RampStop | RampPointerStop> = {};
  const nameAt = (index: number) => `${alpha.prefix}${names[index]}`;

  if (alpha.mode === 'solid' || alpha.mode === 'anchor') {
    names.forEach((_, index) => {
      const opacity = opacityAt(index);
      // Only a stop that IS the anchor's colour points at it: every anchor-mode stop, and the
      // solid twin on the anchor's own step. Other solid twins stay literal — a pointer at the
      // solid sibling would follow an override of it.
      const isAnchorColour =
        alpha.mode === 'anchor' || index === input.anchorIndex;
      const linked = isAnchorColour ? pointer(opacity) : undefined;
      const colour =
        alpha.mode === 'anchor' ? input.anchorStop : input.solidAt(index);
      out[nameAt(index)] = linked ?? { ...colour, alpha: opacity };
    });
    return { stops: out };
  }

  if (alpha.background === undefined) {
    return {
      alphaError: {
        code: 'ramp/missing-background',
        message: "alpha mode 'match' needs a background to composite over",
      },
    };
  }
  if (gamut === 'none') {
    return {
      alphaError: {
        code: 'ramp/alpha-gamut',
        message:
          "alpha mode 'match' needs an RGB gamut to composite in — gamut 'none' has none",
      },
    };
  }
  const background = backgroundOf(input.background);
  if (!background || (background.alpha ?? 1) < 1) {
    return {
      alphaError: {
        code: 'ramp/unresolved-background',
        message: `alpha background ${JSON.stringify(alpha.background)} does not resolve to an opaque colour`,
      },
    };
  }
  const space = CULORI_GAMUT[gamut];
  const toSpace = converter(space);
  const channels = (color: Parameters<typeof toSpace>[0]) => {
    const rgb = toSpace(color);
    if (!rgb) return [0, 0, 0] as [number, number, number]; // inputs are parsed colours
    return [clamp01(rgb.r), clamp01(rgb.g), clamp01(rgb.b)] as [
      number,
      number,
      number,
    ];
  };
  const backdrop = channels(background);
  names.forEach((_, index) => {
    const { components, alpha: opacity } = matchOver(
      channels(culoriOf(input.solidAt(index))),
      backdrop,
    );
    const [r, g, b] = components;
    // Solved in RGB, STORED in oklch like every stop. Converting back to the same RGB space
    // recovers the solved colour within the storage precision, so the composite still holds.
    const solved = oklch({ mode: space, r, g, b });
    const storedL = round(solved.l ?? 0, 4);
    const storedC = round(solved.c ?? 0, 4);
    // With no chroma the conversion's hue is noise (a near-black reads 89.9): write 0 — with
    // C = 0 the hue changes nothing. Not DTCG's "none": core and the exporters don't read it yet.
    const storedH =
      storedC === 0 ? 0 : round((((solved.h ?? 0) % 360) + 360) % 360, 1);
    out[nameAt(index)] = {
      colorSpace: 'oklch',
      components: [storedL, storedC, storedH],
      alpha: opacity,
      hex: formatHex({ mode: space, r, g, b }).toUpperCase(),
    };
  });
  return { stops: out };
}
