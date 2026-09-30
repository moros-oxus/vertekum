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
  COMMITTED,
  computeRamp,
  DEFAULT_PHYSICS,
  parseScalar,
  physicsFor,
  RAMP_KEY,
  type RampConfig,
  type RampPayload,
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

function physicsFrom(settings: RampSettingsType | undefined): RampConfig {
  if (!settings) return DEFAULT_PHYSICS;
  return {
    lightness: settings.lightness,
    ...(settings.ladder ? { ladder: settings.ladder } : {}),
    lightFraction: settings.lightFraction,
    darkExponent: settings.darkExponent,
    gamut: settings.gamut,
    ...(settings.profiles ? { profiles: settings.profiles } : {}),
    ...(settings.defaultProfile
      ? { defaultProfile: settings.defaultProfile }
      : {}),
  };
}

/**
 * A group carrying a ramp payload, and its real children split by who wrote them: `committed` —
 * stops `ramp build` wrote (marked) — and `overrides` — everything the author wrote (unmarked).
 */
export interface RampCarrier {
  set: string;
  path: string[];
  payload: unknown;
  committed: string[];
  overrides: string[];
}

/** True when a child node carries the mark `ramp build` puts on the stops it writes. */
export function isCommitted(node: unknown): boolean {
  const ext = (node as DtcgNode | undefined)?.$extensions as
    | DtcgNode
    | undefined;
  return ext?.[RAMP_KEY] === COMMITTED;
}

/** Every group node carrying a ramp payload. */
export function rampCarriers(files: Record<string, DtcgNode>): RampCarrier[] {
  const out: RampCarrier[] = [];
  const walk = (node: DtcgNode, set: string, path: string[]): void => {
    const ext = node.$extensions as DtcgNode | undefined;
    if (ext && RAMP_KEY in ext && !('$value' in node) && !('$ref' in node)) {
      const children = Object.keys(node).filter((key) => !key.startsWith('$'));
      out.push({
        set,
        path,
        payload: ext[RAMP_KEY],
        committed: children.filter((key) => isCommitted(node[key])),
        overrides: children.filter((key) => !isCommitted(node[key])),
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
        profile: { type: 'string' },
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
        gamut: { enum: ['srgb', 'display-p3', 'none'] },
      },
      additionalProperties: false,
    },
    node: {
      anyOf: [
        { not: { type: 'object' } },
        {
          type: 'object',
          // On a token the key is the committed-stop mark; on a group it is the payload.
          if: { anyOf: [{ required: ['$value'] }, { required: ['$ref'] }] },
          // biome-ignore lint/suspicious/noThenProperty: JSON Schema's if/then keyword, not a thenable
          then: {
            properties: {
              $extensions: {
                type: 'object',
                properties: { [RAMP_KEY]: { const: COMMITTED } },
              },
            },
          },
          else: {
            properties: {
              $extensions: {
                type: 'object',
                properties: { [RAMP_KEY]: { $ref: '#/$defs/payload' } },
              },
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
 * Headless activation: the group codec (virtual stops — core lets an authored child override the
 * one it names), the payload schema, a payload validator (a virtual ramp that cannot compute must
 * be LOUD in `check`, not silently absent), and the `ramp build` command (committed stops).
 */
export function activate(ctx: ActivateContext<typeof tokenRampManifest>): void {
  const settings = (): RampConfig =>
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
        // An authored child that names no step overrides nothing — most often a typo, which
        // would otherwise pass as one more token.
        for (const name of carrier.overrides) {
          if (scale.names.includes(name)) continue;
          out.push({
            code: 'ramp/unknown-stop',
            severity: 'warning',
            message: `'${where}.${name}' is not a step of '${carrier.payload.scalar}' — it overrides nothing`,
            source: 'ext-token-ramp',
            file,
          });
        }
        const physics = physicsFor(settings(), carrier.payload);
        if ('error' in physics) {
          out.push({
            code: 'ramp/unknown-profile',
            severity: 'error',
            message: `'${where}': ${physics.error}`,
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
