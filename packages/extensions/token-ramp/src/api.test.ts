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
