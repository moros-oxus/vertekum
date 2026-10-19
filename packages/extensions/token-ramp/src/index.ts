import { defineExtension, type ExtensionManifest } from '@vertekum/core';
import { z } from 'zod';
import { activate } from './api';

export {
  type AlphaMode,
  alphaFor,
  anchorOf,
  computeRamp,
  DEFAULT_ALPHA,
  DEFAULT_PHYSICS,
  matchOver,
  parseScalar,
  physicsFor,
  RAMP_KEY,
  type RampAlpha,
  type RampAlphaSettings,
  type RampConfig,
  type RampGamut,
  type RampPayload,
  type RampPhysics,
  type RampProfile,
  type RampStop,
} from './ramp';

/**
 * The configurable physics, documented for humans (see the package docs for the worked example):
 *
 * - `lightness` — where the ramp starts and ends, and how it travels. `first` is the palest
 *   step's lightness (OKLCH L, 0–1), `last` the deepest; `ease` bends the spacing (1 = evenly
 *   spaced; >1 bunches the light end, <1 the dark end).
 * - `ladder` — an explicit `step name → L` table. When present it wins over the curve for the
 *   steps it names; use it to reproduce a hand-tuned ladder exactly.
 * - `lightFraction` — how washed-out the palest step is: its chroma is this fraction of the
 *   anchor's (0.2 = one fifth of the brand colour's saturation).
 * - `darkExponent` — how quickly chroma falls on the dark side (higher = duller deep shades).
 * - `gamut` — the colour space every COMPUTED stop is mapped into: `srgb` (default),
 *   `display-p3`, or `none` to store the arch's own chroma whatever it lands on. Mapping holds
 *   lightness and hue and reduces chroma to the gamut boundary, so a stop is always a colour the
 *   target can actually show. The anchor's own step is never mapped — it carries the anchor as
 *   authored (its reference, or its colour verbatim).
 *
 * Multi-brand systems declare **profiles** — named partials of the same fields — and each ramp
 * payload selects one by name (`"profile": "brand-a"`), or `defaultProfile` routes every silent
 * payload through one. Resolution is per field: defaults ← top-level settings ← profile ←
 * payload overrides — `alpha` included — with ladder tables (`ladder`, `alpha.ladder`) merging by
 * step key.
 *
 * - `alpha` — defaults for a ramp's translucent twin series (`A100` beside `100`): `mode`
 *   (`solid`, `anchor`, `match`), `prefix`, and `background` (what `match` composites over).
 *   Opacity is assigned exactly as lightness is: `alpha.opacity` is the curve (`first`, `last`,
 *   `ease`) and `alpha.ladder` an explicit `step name → opacity` table that wins where it speaks.
 *   They never turn the series on: only a payload's `alpha` does.
 *
 * Every field may also be overridden per ramp, inside the ramp's own payload.
 */
const AlphaSettings = z
  .object({
    mode: z.enum(['solid', 'anchor', 'match']).optional(),
    prefix: z
      .string()
      .regex(/^[A-Za-z][A-Za-z0-9-]*$/)
      .optional(),
    opacity: z
      .object({
        first: z.number().min(0).max(1).optional(),
        last: z.number().min(0).max(1).optional(),
        ease: z.number().positive().optional(),
      })
      .optional(),
    ladder: z.record(z.number().min(0).max(1)).optional(),
    background: z.unknown().optional(),
  })
  .optional();

export const RampSettings = z.object({
  lightness: z
    .object({
      first: z.number().min(0).max(1).default(0.958),
      last: z.number().min(0).max(1).default(0.27),
      ease: z.number().positive().default(1),
    })
    .default({}),
  ladder: z.record(z.number().min(0).max(1)).optional(),
  lightFraction: z.number().positive().max(1).default(0.2),
  darkExponent: z.number().positive().default(0.85),
  gamut: z.enum(['srgb', 'display-p3', 'none']).default('srgb'),
  profiles: z
    .record(
      z.object({
        lightness: z
          .object({
            first: z.number().min(0).max(1).optional(),
            last: z.number().min(0).max(1).optional(),
            ease: z.number().positive().optional(),
          })
          .optional(),
        ladder: z.record(z.number().min(0).max(1)).optional(),
        lightFraction: z.number().positive().max(1).optional(),
        darkExponent: z.number().positive().optional(),
        gamut: z.enum(['srgb', 'display-p3', 'none']).optional(),
        alpha: AlphaSettings,
      }),
    )
    .optional(),
  defaultProfile: z.string().optional(),
  alpha: AlphaSettings,
});
export type RampSettingsType = z.infer<typeof RampSettings>;

export const tokenRampManifest = {
  id: 'vtk.token.ramp',
  name: 'Token Ramps',
  description:
    "Generates colour ramps from a single brand anchor: a group carrying an 'org.vertekum.generate/ramp' payload expands into its stops (virtual), or 'vertekum ramp build' writes them as real tokens (committed). A non-view extension: no route, no ribbon entry.",
  activation: ['onStartup'],
  settings: RampSettings,
} satisfies ExtensionManifest;

/**
 * First-party NON-VIEW HostExtension: a group codec, a payload schema, a payload validator, and
 * the `ramp build` command. Opt-in — a consumer chooses generated colour, never inherits it.
 */
export const tokenRampExtension = defineExtension<typeof tokenRampManifest>({
  manifest: tokenRampManifest,
  activate,
});
