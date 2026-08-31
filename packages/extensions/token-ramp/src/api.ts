import {
  type ActivateContext,
  createValidatorRegistry,
  type Diagnostic,
  type DtcgNode,
  isResolverFile,
  SCHEMA_BINDING_SERVICE,
  type SchemaBindingService,
  TOKEN_CODEC_SERVICE,
  type Token,
  type TokenCodecService,
  VALIDATOR_SERVICE,
  type ValidatorService,
} from '@vertekum/core';
import { rampBuildCommand } from './cli';
import type { RampSettingsType, tokenRampManifest } from './index';
import {
  computeRamp,
  DEFAULT_PHYSICS,
  parseScalar,
  RAMP_KEY,
  type RampPayload,
  type RampPhysics,
} from './ramp';

/** Follow alias chains (`"{a.b}"`) through the token list; cycle-guarded. */
export function followAliases(value: unknown, tokens: Token[]): unknown {
  const byPath = new Map(tokens.map((token) => [token.path.join('.'), token]));
  const seen = new Set<string>();
  let held = value;
  while (typeof held === 'string' && /^\{[^}]+\}$/.test(held)) {
    const target = held.slice(1, -1);
    if (seen.has(target)) return undefined;
    seen.add(target);
    const token = byPath.get(target);
    if (!token) return undefined;
    held = token.value;
  }
  return held;
}

function isPayload(payload: unknown): payload is RampPayload {
  return (
    !!payload &&
    typeof payload === 'object' &&
    'anchor' in payload &&
    typeof (payload as { scalar?: unknown }).scalar === 'string'
  );
}

function physicsFrom(settings: RampSettingsType | undefined): RampPhysics {
  if (!settings) return DEFAULT_PHYSICS;
  return {
    lightness: settings.lightness,
    ...(settings.ladder ? { ladder: settings.ladder } : {}),
    lightFraction: settings.lightFraction,
    darkExponent: settings.darkExponent,
  };
}

/** Every group node carrying a ramp payload: `[path, payload, hasChildren]`. */
export function rampCarriers(
  files: Record<string, DtcgNode>,
): Array<{ set: string; path: string[]; payload: unknown; children: boolean }> {
  const out: Array<{
    set: string;
    path: string[];
    payload: unknown;
    children: boolean;
  }> = [];
  const walk = (node: DtcgNode, set: string, path: string[]): void => {
    const ext = node.$extensions as DtcgNode | undefined;
    if (ext && RAMP_KEY in ext && !('$value' in node)) {
      out.push({
        set,
        path,
        payload: ext[RAMP_KEY],
        children: Object.keys(node).some((key) => !key.startsWith('$')),
      });
    }
    for (const [key, child] of Object.entries(node)) {
      if (key.startsWith('$')) continue;
      if (child && typeof child === 'object') {
        walk(child as DtcgNode, set, [...path, key]);
      }
    }
  };
  for (const [name, tree] of Object.entries(files)) {
    if (isResolverFile(name)) continue;
    walk(tree, name.replace(/\.json$/, ''), []);
  }
  return out;
}

/** The payload's shape, validated where it appears — recursive walker, 2020-12. */
const PAYLOAD_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $defs: {
    payload: {
      type: 'object',
      required: ['anchor', 'scalar'],
      properties: {
        anchor: {
          anyOf: [{ type: 'string' }, { type: 'object' }],
        },
        scalar: { type: 'string', pattern: '^\\d+-\\d+/\\d+$' },
        hueDrift: { type: 'number' },
        ladder: { type: 'object', additionalProperties: { type: 'number' } },
        lightness: {
          type: 'object',
          properties: {
            first: { type: 'number' },
            last: { type: 'number' },
            ease: { type: 'number' },
          },
          additionalProperties: false,
        },
        lightFraction: { type: 'number' },
        darkExponent: { type: 'number' },
      },
      additionalProperties: false,
    },
    node: {
      anyOf: [
        { not: { type: 'object' } },
        {
          type: 'object',
          properties: {
            $extensions: {
              type: 'object',
              properties: { [RAMP_KEY]: { $ref: '#/$defs/payload' } },
            },
          },
          additionalProperties: { $ref: '#/$defs/node' },
        },
      ],
    },
  },
  $ref: '#/$defs/node',
};

/**
 * Headless activation: the group codec (virtual ramps), the payload schema, a payload validator
 * (a virtual ramp that cannot compute must be LOUD in `check`, not silently absent), and the
 * `ramp build` command (committed ramps).
 */
export function activate(ctx: ActivateContext<typeof tokenRampManifest>): void {
  const settings = (): RampPhysics =>
    physicsFrom(ctx.config.get() as RampSettingsType | undefined);

  ctx.services.get<TokenCodecService>(TOKEN_CODEC_SERVICE)?.register({
    key: RAMP_KEY,
    expand(payload, _at, expandCtx) {
      if (!isPayload(payload)) return null;
      const ramp = computeRamp(
        payload,
        settings(),
        expandCtx.resolve(payload.anchor),
      );
      if ('error' in ramp) return null;
      return Object.fromEntries(
        Object.entries(ramp.stops).map(([name, stop]) => [
          name,
          { type: 'color', value: stop },
        ]),
      );
    },
  });

  ctx.services.get<SchemaBindingService>(SCHEMA_BINDING_SERVICE)?.register({
    match: '*',
    target: 'tokens',
    domain: 'ramp',
    schema: PAYLOAD_SCHEMA,
  });

  const validators =
    ctx.services.get<ValidatorService>(VALIDATOR_SERVICE) ??
    (() => {
      const registry = createValidatorRegistry();
      ctx.services.register(VALIDATOR_SERVICE, registry);
      return registry;
    })();
  validators.register({
    id: 'ramp.payloads',
    name: 'Ramp payloads',
    validate({ files, tokens }) {
      if (!files) return [];
      const out: Diagnostic[] = [];
      for (const carrier of rampCarriers(files)) {
        const where = carrier.path.join('.');
        const file = `${carrier.set}.json`;
        if (!isPayload(carrier.payload)) continue; // shape problems are the schema's to report
        const scale = parseScalar(carrier.payload.scalar);
        if ('error' in scale) {
          out.push({
            code: 'ramp/invalid-scalar',
            severity: 'error',
            message: `'${where}': ${scale.error}`,
            source: 'ext-token-ramp',
            file,
          });
          continue;
        }
        const ramp = computeRamp(
          carrier.payload,
          settings(),
          followAliases(carrier.payload.anchor, tokens),
        );
        if ('error' in ramp) {
          out.push({
            code: 'ramp/unresolved-anchor',
            severity: 'error',
            message: `'${where}': ${ramp.error}`,
            source: 'ext-token-ramp',
            file,
          });
        }
      }
      return out;
    },
  });

  ctx.commands.register(rampBuildCommand(settings));
}
