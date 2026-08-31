import { defineExtension, type ExtensionManifest } from '@vertekum/core';
import { z } from 'zod';
import { activate } from './api';

export {
  anchorOf,
  computeRamp,
  DEFAULT_PHYSICS,
  parseScalar,
  physicsOf,
  RAMP_KEY,
  type RampPayload,
  type RampPhysics,
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
 *
 * Every field may also be overridden per ramp, inside the ramp's own payload.
 */
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
