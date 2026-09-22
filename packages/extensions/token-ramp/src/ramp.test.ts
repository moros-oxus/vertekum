import { inGamut, oklch, parse as parseColor } from 'culori';
import { expect, test } from 'vitest';
import {
  anchorOf,
  computeRamp,
  DEFAULT_PHYSICS,
  parseScalar,
  physicsFor,
  type RampPhysics,
  type RampStop,
} from './ramp';

const inSrgb = inGamut('rgb');

/** A stop as culori sees it, for gamut and round-trip assertions. */
const asColor = (stop: RampStop) => ({
  mode: 'oklch' as const,
  l: stop.components[0],
  c: stop.components[1],
  h: stop.components[2],
});

/** A hand-eased ten-step reference ladder (the shape a designed system documents). */
const BRAND_A: RampPhysics = {
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

test('the reference teal ramp reproduces from its anchor', () => {
  const ramp = computeRamp(
    { anchor: '#1DB1A8', scalar: '100-1000/100' },
    BRAND_A,
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
    BRAND_A,
    '#FFCD00',
  );
  const driftedR = computeRamp(
    { anchor: '#FFCD00', scalar: '100-1000/100', hueDrift: -18 },
    BRAND_A,
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
    BRAND_A,
    object,
  );
  if ('error' in ramp) throw new Error(ramp.error);
  const stops = ramp.stops;
  expect(stops['500']).toEqual(object);

  const refused = computeRamp(
    { anchor: '{nope}', scalar: '100-1000/100' },
    BRAND_A,
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

/**
 * A saturated yellow anchor drives most of its ramp outside sRGB under the arch alone — the
 * case that made an exporter emit each stop three times, once per gamut.
 */
const YELLOW = { anchor: '#FFCD00', scalar: '100-1000/100' } as const;

test('computed stops are mapped into sRGB, holding lightness and hue', () => {
  const mappedR = computeRamp(YELLOW, BRAND_A, YELLOW.anchor);
  const rawR = computeRamp(
    { ...YELLOW, gamut: 'none' },
    BRAND_A,
    YELLOW.anchor,
  );
  if ('error' in mappedR || 'error' in rawR) throw new Error('no ramp');

  // Unmapped, this ramp really is out of gamut — otherwise the test below proves nothing.
  const rawOut = Object.values(rawR.stops).filter((s) => !inSrgb(asColor(s)));
  expect(rawOut.length).toBeGreaterThan(0);

  for (const [step, stop] of Object.entries(mappedR.stops)) {
    if (step === '300') continue; // the anchor's step — carried verbatim, never mapped
    expect(inSrgb(asColor(stop)), `${step} ${stop.hex}`).toBe(true);

    // L and h are held; only C moves, and only ever downward.
    const raw = rawR.stops[step] as RampStop;
    expect(stop.components[0]).toBeCloseTo(raw.components[0], 4);
    expect(stop.components[2]).toBeCloseTo(raw.components[2], 1);
    expect(stop.components[1]).toBeLessThanOrEqual(raw.components[1] + 1e-9);
  }
});

test("gamut 'none' stores the arch's own chroma, unmapped", () => {
  const ramp = computeRamp(
    { ...YELLOW, gamut: 'none' },
    BRAND_A,
    YELLOW.anchor,
  );
  if ('error' in ramp) throw new Error(ramp.error);
  // The escape hatch is real: the pre-mapping behaviour is still reachable.
  expect(Object.values(ramp.stops).some((s) => !inSrgb(asColor(s)))).toBe(true);
});

test('a stop’s hex and components describe the same colour', () => {
  const ramp = computeRamp(YELLOW, BRAND_A, YELLOW.anchor);
  if ('error' in ramp) throw new Error(ramp.error);
  for (const [step, stop] of Object.entries(ramp.stops)) {
    const fromHex = oklch(parseColor(stop.hex));
    if (!fromHex) throw new Error(`unparseable hex ${stop.hex}`);
    expect(fromHex.l, `${step} L`).toBeCloseTo(stop.components[0], 2);
    expect(fromHex.c, `${step} C`).toBeCloseTo(stop.components[1], 2);
  }
});

test('gamut resolves through the four-layer chain', () => {
  const config = {
    ...DEFAULT_PHYSICS,
    gamut: 'srgb' as const,
    profiles: { wide: { gamut: 'display-p3' as const } },
  };
  const base = physicsFor(config, YELLOW);
  if ('error' in base) throw new Error(base.error);
  expect(base.gamut).toBe('srgb');

  const viaProfile = physicsFor(config, { ...YELLOW, profile: 'wide' });
  if ('error' in viaProfile) throw new Error(viaProfile.error);
  expect(viaProfile.gamut).toBe('display-p3');

  // The payload beats the profile, as every other physics field does.
  const viaPayload = physicsFor(config, {
    ...YELLOW,
    profile: 'wide',
    gamut: 'none',
  });
  if ('error' in viaPayload) throw new Error(viaPayload.error);
  expect(viaPayload.gamut).toBe('none');
});

test('display-p3 maps less aggressively than srgb', () => {
  const srgbR = computeRamp(YELLOW, BRAND_A, YELLOW.anchor);
  const p3R = computeRamp(
    { ...YELLOW, gamut: 'display-p3' },
    BRAND_A,
    YELLOW.anchor,
  );
  if ('error' in srgbR || 'error' in p3R) throw new Error('no ramp');
  // The wider target keeps more chroma somewhere — and the name really is honoured:
  // culori spells this gamut 'p3' and throws on 'display-p3', so a pass-through would fail here.
  const widerSomewhere = Object.keys(srgbR.stops).some(
    (step) =>
      (p3R.stops[step] as RampStop).components[1] >
      (srgbR.stops[step] as RampStop).components[1] + 1e-6,
  );
  expect(widerSomewhere).toBe(true);
});

test('anchorOf normalizes hex and passes oklch objects through', () => {
  const fromHex = anchorOf('#1db1a8');
  expect(fromHex?.stop.hex).toBe('#1DB1A8');
  expect(fromHex?.l).toBeCloseTo(0.688, 2);
  expect(anchorOf(42)).toBeNull();
});

test('profiles resolve through the four-layer chain, ladders merging by step key', async () => {
  const { physicsFor } = await import('./ramp');
  const config = {
    ...DEFAULT_PHYSICS,
    ladder: { '100': 0.9, '200': 0.8 },
    profiles: {
      'brand-a': { ladder: { '200': 0.7, '300': 0.6 }, lightFraction: 0.3 },
    },
    defaultProfile: 'brand-a',
  };

  // defaultProfile applies when the payload is silent; ladders merge by key.
  const silent = physicsFor(config, { anchor: '#000', scalar: '100-300/100' });
  if ('error' in silent) throw new Error(silent.error);
  expect(silent.ladder).toEqual({ '100': 0.9, '200': 0.7, '300': 0.6 });
  expect(silent.lightFraction).toBe(0.3);

  // Payload overrides beat the profile; payload ladder keys win.
  const overridden = physicsFor(config, {
    anchor: '#000',
    scalar: '100-300/100',
    lightFraction: 0.1,
    ladder: { '300': 0.5 },
  });
  if ('error' in overridden) throw new Error(overridden.error);
  expect(overridden.lightFraction).toBe(0.1);
  expect(overridden.ladder?.['300']).toBe(0.5);
  expect(overridden.ladder?.['200']).toBe(0.7);

  // An explicit payload profile beats defaultProfile.
  const named = physicsFor(
    { ...config, profiles: { ...config.profiles, plain: {} } },
    { anchor: '#000', scalar: '100-300/100', profile: 'plain' },
  );
  if ('error' in named) throw new Error(named.error);
  expect(named.lightFraction).toBe(DEFAULT_PHYSICS.lightFraction);

  // Unknown names are errors naming what IS defined — payload or defaultProfile alike.
  const unknown = physicsFor(config, {
    anchor: '#000',
    scalar: '100-300/100',
    profile: 'nope',
  });
  expect('error' in unknown && unknown.error).toContain(
    "unknown profile 'nope'",
  );
  expect('error' in unknown && unknown.error).toContain('brand-a');
  const badDefault = physicsFor(
    { ...DEFAULT_PHYSICS, defaultProfile: 'ghost' },
    { anchor: '#000', scalar: '100-300/100' },
  );
  expect('error' in badDefault && badDefault.error).toContain('ghost');
});
