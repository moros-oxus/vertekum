import { expect, test } from 'vitest';
import {
  anchorOf,
  computeRamp,
  DEFAULT_PHYSICS,
  parseScalar,
  type RampPhysics,
  type RampStop,
} from './ramp';

/** The Rexall v2 ladder — the hand-eased table the preview page documents. */
const REXALL: RampPhysics = {
  ...DEFAULT_PHYSICS,
  ladder: {
    '100': 0.958,
    '200': 0.91,
    '300': 0.86,
    '400': 0.795,
    '500': 0.715,
    '600': 0.635,
    '700': 0.545,
    '800': 0.455,
    '900': 0.365,
    '1000': 0.27,
  },
};

const channel = (hex: string, index: number): number =>
  Number.parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16);

function expectHexClose(actual: string, expected: string, tolerance = 3): void {
  for (const index of [0, 1, 2]) {
    expect(
      Math.abs(channel(actual, index) - channel(expected, index)),
      `${actual} vs ${expected}`,
    ).toBeLessThanOrEqual(tolerance);
  }
}

test('the Rexall teal ramp reproduces from its anchor', () => {
  const ramp = computeRamp(
    { anchor: '#1DB1A8', scalar: '100-1000/100' },
    REXALL,
    '#1DB1A8',
  );
  if ('error' in ramp) throw new Error(ramp.error);
  const stops = ramp.stops;

  // Anchor placed by nearest ladder L (0.688 → 500) and carried VERBATIM.
  expect(stops['500']?.hex).toBe('#1DB1A8');

  const expected: Record<string, string> = {
    '100': '#E1F6F4',
    '200': '#C3EBE6',
    '300': '#A4DED8',
    '400': '#7BCDC6',
    '600': '#149F97',
    '700': '#03817A',
    '800': '#00655F',
    '900': '#004945',
    '1000': '#002E2B',
  };
  for (const [step, hex] of Object.entries(expected)) {
    expectHexClose((stops[step] as RampStop).hex, hex);
  }

  // The published kl for teal is 0.80; C(100) = 0.2 × Cₐ by construction.
  const c100 = (stops['100'] as RampStop).components[1];
  const ca = (stops['500'] as RampStop).components[1];
  expect(c100 / ca).toBeCloseTo(0.2, 2);
});

test('hueDrift rotates only the dark side, reaching the full drift at the last step', () => {
  const stillR = computeRamp(
    { anchor: '#FFCD00', scalar: '100-1000/100' },
    REXALL,
    '#FFCD00',
  );
  const driftedR = computeRamp(
    { anchor: '#FFCD00', scalar: '100-1000/100', hueDrift: -18 },
    REXALL,
    '#FFCD00',
  );
  if ('error' in stillR || 'error' in driftedR) throw new Error('no ramp');
  const still = stillR.stops;
  const drifted = driftedR.stops;
  // Light side identical; the last step's hue moved by the full drift.
  expect((drifted['100'] as RampStop).hex).toBe((still['100'] as RampStop).hex);
  const h = (step: Record<string, RampStop>, name: string) =>
    (step[name] as RampStop).components[2];
  expect(h(drifted, '1000') - h(still, '1000')).toBeCloseTo(-18, 0);
});

test('a stored colour object anchors verbatim; a non-colour refuses', () => {
  const object = {
    colorSpace: 'oklch',
    components: [0.688, 0.115, 188.2],
    alpha: 1,
    hex: '#1DB1A8',
  };
  const ramp = computeRamp(
    { anchor: '{brand.pool}', scalar: '100-1000/100' },
    REXALL,
    object,
  );
  if ('error' in ramp) throw new Error(ramp.error);
  const stops = ramp.stops;
  expect(stops['500']).toEqual(object);

  const refused = computeRamp(
    { anchor: '{nope}', scalar: '100-1000/100' },
    REXALL,
    undefined,
  );
  expect('error' in refused && refused.error).toContain('anchor');
});

test('the curve serves any scalar; the explicit ladder wins where it speaks', () => {
  const scale = parseScalar('050-200/50');
  if ('error' in scale) throw new Error(scale.error);
  expect(scale.names).toEqual(['050', '100', '150', '200']);
  expect('error' in parseScalar('100-1000')).toBe(true);

  // A dark anchor (L ≈ 0.27) lands on step 300, so 100 and 200 stay calculated.
  const ramp = computeRamp(
    {
      anchor: '#002E2B',
      scalar: '100-300/100',
      ladder: { '200': 0.5 },
    },
    DEFAULT_PHYSICS,
    '#002E2B',
  );
  if ('error' in ramp) throw new Error(ramp.error);
  const stops = ramp.stops;
  expect(stops['300']?.hex).toBe('#002E2B'); // the anchor, verbatim
  expect((stops['200'] as RampStop).components[0]).toBe(0.5); // ladder override
  expect((stops['100'] as RampStop).components[0]).toBeCloseTo(0.958, 3); // curve first
});

test('anchorOf normalizes hex and passes oklch objects through', () => {
  const fromHex = anchorOf('#1db1a8');
  expect(fromHex?.stop.hex).toBe('#1DB1A8');
  expect(fromHex?.l).toBeCloseTo(0.688, 2);
  expect(anchorOf(42)).toBeNull();
});
