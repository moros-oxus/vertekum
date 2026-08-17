import { type ZodTypeAny, z } from 'zod';
import type { ExtensionContext } from '../shell/types';
import type { ScopedConfig } from './config-store';

/** Activation timing. Only eager startup is honored today; the union is a seam for lazy events. */
export type ActivationEvent = 'onStartup';

/**
 * The thin, serializable-by-discipline metadata an extension declares statically (design spec
 * 2026-07-03): identity + a Zod settings schema. Contribution points (routes/slots/services)
 * are NOT declared here — they stay imperative in activate(), because icons are React
 * components and rich static declaration only pays off once hosted/sandboxed.
 */
export interface ExtensionManifest {
  id: string;
  name: string;
  description?: string;
  settings?: ZodTypeAny;
  activation?: ActivationEvent[];
}

/** Runtime validator for a manifest (dev-time guard). */
export const ExtensionManifestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  settings: z.instanceof(z.ZodType).optional(),
  activation: z.array(z.literal('onStartup')).optional(),
});

/**
 * What `ctx.config.get()` RETURNS: the schema's output type, with every `.default()` applied — so an
 * extension reads a fully-populated settings object and never has to re-supply a fallback.
 */
export type ExtensionSettings<M> = M extends { settings: infer S }
  ? S extends ZodTypeAny
    ? z.infer<S>
    : Record<string, never>
  : Record<string, never>;

/**
 * What a consumer WRITES in `vertekum.config.ts`: the schema's input type, where a `.default()`
 * field is optional — which is the point of declaring a default.
 *
 * The distinction matters beyond the top level. `Partial<>` makes top-level keys optional, but a
 * defaulted field NESTED inside an array or object (a target's `enabled`, a release provider's
 * `lockPath`) stays required in the output type, forcing an author to restate values the schema
 * already supplies.
 */
export type ExtensionSettingsInput<M> = M extends { settings: infer S }
  ? S extends ZodTypeAny
    ? z.input<S>
    : Record<string, never>
  : Record<string, never>;

/**
 * The context handed to `activate()`: the shared ExtensionContext plus a config view scoped and
 * typed to THIS extension's settings schema (via z.infer), so authors get autocomplete on their
 * own config with no call-site generic.
 */
export type ActivateContext<M extends ExtensionManifest> = ExtensionContext & {
  config: ScopedConfig<ExtensionSettings<M>>;
};
