import {
  createKernel,
  VALIDATOR_SERVICE,
  type ValidatorService,
} from '@vertekum/core';
import { expect, test } from 'vitest';
import { tokenRampExtension } from './index';
import { RAMP_KEY } from './ramp';

/** The ramp validator's diagnostics for one teal ramp carrying what the author adds. */
async function diagnostics(authored: Record<string, unknown>) {
  const kernel = createKernel();
  kernel.register(tokenRampExtension);
  kernel.start();
  kernel.document.hydrate({
    'core.json': {
      brand: { accent: { $type: 'color', $value: '#1DB1A8' } },
      color: {
        teal: {
          $extensions: {
            [RAMP_KEY]: { anchor: '{brand.accent}', scalar: '100-500/100' },
          },
          ...authored,
        },
      },
    },
  });
  const validator = kernel.services
    .get<ValidatorService>(VALIDATOR_SERVICE)
    ?.list()
    .find((v) => v.id === 'ramp.payloads');
  if (!validator) throw new Error('ramp.payloads is not registered');
  return validator.validate({
    tokens: kernel.document.getAllTokens(),
    sets: kernel.document.getSets(),
    resolvers: new Map(),
    files: kernel.document.getFiles(),
  });
}

const stop = { $type: 'color', $value: '#ff0000' };

test('a child naming no step is loud — it overrides nothing', async () => {
  expect(await diagnostics({ '30': stop })).toEqual([
    {
      code: 'ramp/unknown-stop',
      severity: 'warning',
      message:
        "'color.teal.30' is not a step of '100-500/100' — it overrides nothing",
      source: 'ext-token-ramp',
      file: 'core.json',
    },
  ]);
});

test('a real step, a $root, and a committed stop are not unknown', async () => {
  expect(
    await diagnostics({
      $root: stop,
      '200': stop,
      '300': { ...stop, $extensions: { [RAMP_KEY]: 'committed' } },
    }),
  ).toEqual([]);
});

/** A kernel hydrated with one ramp payload (and the tokens it may reference). */
function rampKernel(
  payload: Record<string, unknown>,
  anchor = '{brand.accent}',
) {
  const kernel = createKernel();
  kernel.register(tokenRampExtension);
  kernel.start();
  kernel.document.hydrate({
    'core.json': {
      brand: {
        base: {
          $type: 'color',
          $value: {
            colorSpace: 'oklch',
            components: [0.6884, 0.1148, 188.2],
            alpha: 1,
            hex: '#1DB1A8',
          },
        },
        accent: { $type: 'color', $value: '{brand.base}' },
        legacy: { $type: 'color', $value: '#1DB1A8' },
      },
      surface: { page: { $type: 'color', $value: '#FFFFFF' } },
      color: {
        teal: {
          $extensions: {
            [RAMP_KEY]: { anchor, scalar: '100-500/100', ...payload },
          },
        },
      },
    },
  });
  const at = (path: string) =>
    kernel.document.getAllTokens().find((t) => t.path.join('.') === path);
  return { kernel, at };
}

test('the codec generates the alpha twins; a pointer stop materializes to the anchor colour at its opacity', () => {
  const { at } = rampKernel({ alpha: { mode: 'anchor' } });
  const a100 = at('color.teal.A100');
  expect(a100?.generated).toBe(true);
  // Authored as pointers to the END of the anchor's alias chain (brand.base, not brand.accent)…
  expect(a100?.sourceValue).toEqual({
    colorSpace: { $ref: '#/brand/base/$value/colorSpace' },
    components: { $ref: '#/brand/base/$value/components' },
    alpha: 0.05,
  });
  // …and materialized to the colour they point at.
  const base = at('brand.base')?.value as { components: number[] };
  expect((a100?.value as { components: number[] }).components).toEqual(
    base.components,
  );
  expect((a100?.value as { alpha: number }).alpha).toBe(0.05);

  // A legacy hex-string anchor has no members to point into: its twins are literals.
  const legacy = rampKernel({ alpha: { mode: 'anchor' } }, '{brand.legacy}');
  const twin = legacy.at('color.teal.A100');
  expect(twin?.sourceValue).toBeUndefined();
  expect((twin?.value as { colorSpace: string }).colorSpace).toBe('oklch');
});

test('match resolves its background in the carrier scope; a bad background drops only the alpha twins', async () => {
  const matched = rampKernel({
    alpha: { mode: 'match', background: '{surface.page}' },
  });
  expect(
    (matched.at('color.teal.A300')?.value as { colorSpace: string }).colorSpace,
  ).toBe('srgb');

  const broken = rampKernel({ alpha: { mode: 'match', background: '{nope}' } });
  expect(broken.at('color.teal.300')?.generated).toBe(true);
  expect(broken.at('color.teal.A300')).toBeUndefined();
});

test('the alpha diagnostics are loud, and unknown-stop knows the alpha names', async () => {
  const codes = async (payload: Record<string, unknown>, authored = {}) => {
    const { kernel } = rampKernel(payload);
    if (Object.keys(authored).length > 0) {
      const files = structuredClone(kernel.document.getFiles());
      type Tree = Record<string, Record<string, Record<string, unknown>>>;
      Object.assign(
        (files['core.json'] as unknown as Tree).color?.teal ?? {},
        authored,
      );
      kernel.document.hydrate(files);
    }
    const validator = kernel.services
      .get<ValidatorService>(VALIDATOR_SERVICE)
      ?.list()
      .find((v) => v.id === 'ramp.payloads');
    const out = await validator?.validate({
      tokens: kernel.document.getAllTokens(),
      sets: kernel.document.getSets(),
      resolvers: new Map(),
      files: kernel.document.getFiles(),
    });
    return (out ?? []).map((d) => `${d.severity}:${d.code}`);
  };
  expect(await codes({ alpha: { mode: 'match' } })).toEqual([
    'error:ramp/missing-background',
  ]);
  expect(
    await codes({ alpha: { mode: 'match', background: '{nope}' } }),
  ).toEqual(['error:ramp/unresolved-background']);
  expect(
    await codes({
      gamut: 'none',
      alpha: { mode: 'match', background: '#FFFFFF' },
    }),
  ).toEqual(['error:ramp/alpha-gamut']);
  expect(await codes({ alpha: true }, { A300: stop })).toEqual([]);
  expect(await codes({ alpha: true }, { B300: stop })).toEqual([
    'warning:ramp/unknown-stop',
  ]);
});
