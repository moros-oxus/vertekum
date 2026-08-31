import { evaluateScale } from '@vertekum/core';
import { formatHex, oklch, parse as parseColor } from 'culori';

/**
 * The ramp model — one brand anchor, a shared lightness ladder, chroma arched through the anchor.
 *
 * In OKLCH terms, for a ramp of N steps:
 *
 * - **L (lightness)** comes from the ladder: an explicit per-step table when configured, else a
 *   curve from `lightness.first` to `lightness.last` (`L = first + (last − first) · t^ease`).
 *   The step number is therefore a lightness — a contrast duty — never a measure of saturation.
 * - **The anchor keeps its colour verbatim.** It lands on the step whose ladder L is nearest its
 *   own L; that step carries the brand colour exactly (its own L, C, h, hex). The ladder
 *   positions the anchor; it never repaints it.
 * - **C (chroma)** arches through the anchor:
 *   lighter · `C = Cₐ · ((1−L)/(1−Lₐ))^kl`, with `kl = ln(lightFraction) / ln((1−L_first)/(1−Lₐ))`
 *   — solved so the palest step is always `lightFraction × Cₐ`, wherever the anchor landed;
 *   darker · `C = Cₐ · (L/Lₐ)^darkExponent`.
 * - **h (hue)** is held. With `hueDrift`, steps darker than the anchor rotate linearly, reaching
 *   `hₐ + hueDrift` at the last step (deep yellows drift toward orange instead of going olive).
 */

/** The `$extensions` key this extension owns — the first-party generator family. */
export const RAMP_KEY = 'org.vertekum.generate/ramp';

export interface RampPhysics {
  /** L endpoints + curve for ANY ramp length. `ease: 1` = evenly spaced. */
  lightness: { first: number; last: number; ease: number };
  /** Explicit per-step L table; WINS over the curve for the steps it names. */
  ladder?: Record<string, number>;
  /** C(first) = lightFraction × C(anchor). */
  lightFraction: number;
  /** The dark-side chroma exponent. */
  darkExponent: number;
}

export const DEFAULT_PHYSICS: RampPhysics = {
  lightness: { first: 0.958, last: 0.27, ease: 1 },
  lightFraction: 0.2,
  darkExponent: 0.85,
};

export interface RampPayload {
  /** A colour (hex or stored object) or a reference (`"{brand.poolside-blue}"`). */
  anchor: unknown;
  /** Step names, in the dfn range grammar: `"100-1000/100"`, `"050-500/50"`. */
  scalar: string;
  /** Degrees of dark-side hue rotation, reached at the last step. Default 0 (hue held). */
  hueDrift?: number;
  /** Per-ramp overrides of the configured physics. */
  ladder?: Record<string, number>;
  lightness?: Partial<RampPhysics['lightness']>;
  lightFraction?: number;
  darkExponent?: number;
}

/** A stored DTCG colour value in oklch notation. */
export interface RampStop {
  colorSpace: 'oklch';
  components: [number, number, number];
  alpha: number;
  hex: string;
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

/** Merge the configured physics with a payload's per-ramp overrides. */
export function physicsOf(
  settings: RampPhysics,
  payload: RampPayload,
): RampPhysics {
  return {
    lightness: { ...settings.lightness, ...(payload.lightness ?? {}) },
    ladder: { ...(settings.ladder ?? {}), ...(payload.ladder ?? {}) },
    lightFraction: payload.lightFraction ?? settings.lightFraction,
    darkExponent: payload.darkExponent ?? settings.darkExponent,
  };
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

/**
 * Compute a whole ramp: step name → stored colour value. The anchor step carries the brand
 * colour verbatim; every other step is calculated. Returns an error string instead when the
 * payload cannot compute (bad scalar, non-colour anchor).
 */
export function computeRamp(
  payload: RampPayload,
  settings: RampPhysics,
  resolvedAnchor: unknown,
): { stops: Record<string, RampStop> } | { error: string } {
  const scale = parseScalar(payload.scalar);
  if ('error' in scale) return scale;
  const anchor = anchorOf(resolvedAnchor);
  if (!anchor) {
    return {
      error: `anchor does not resolve to a colour (got ${JSON.stringify(resolvedAnchor) ?? 'nothing'})`,
    };
  }

  const physics = physicsOf(settings, payload);
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
  const out: Record<string, RampStop> = {};
  names.forEach((name, index) => {
    if (index === anchorIndex) {
      out[name] = anchor.stop;
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
    const hex = formatHex({ mode: 'oklch', l: L, c, h });
    out[name] = {
      colorSpace: 'oklch',
      components: [round(L, 4), round(c, 4), round(((h % 360) + 360) % 360, 1)],
      alpha: 1,
      hex: hex.toUpperCase(),
    };
  });
  return { stops: out };
}
