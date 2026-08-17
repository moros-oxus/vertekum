import { expect, test } from 'vitest';
import { z } from 'zod';
import type { ExtensionManifest } from '../config/manifest';
import { defineExtension } from './define-extension';

const manifest = {
  id: 'vtk.demo',
  name: 'Demo',
  settings: z.object({ flag: z.boolean().default(false) }),
  activation: ['onStartup'],
} satisfies import('../config/manifest').ExtensionManifest;

const ext = defineExtension<typeof manifest>({
  manifest,
  activate() {},
});

test('an uncalled configurable extension is still a plain Extension', () => {
  expect(ext.manifest.id).toBe('vtk.demo');
  expect(typeof ext.activate).toBe('function');
});

test('calling with overrides returns { extension, overrides }', () => {
  const configured = ext({ flag: true });
  expect(configured.overrides).toEqual({ flag: true });
  expect(configured.extension.manifest.id).toBe('vtk.demo');
});

test('calling with no args yields empty overrides', () => {
  expect(ext().overrides).toEqual({});
});

/**
 * Authoring uses the schema's INPUT type, so a `.default()` field is optional to write — including
 * one nested inside an array, where `Partial<>` does not reach. This previously forced a consumer
 * to restate `enabled: true` on every export target.
 */
const nestedManifest = {
  id: 'vtk.nested',
  name: 'Nested',
  settings: z.object({
    targets: z
      .array(z.object({ out: z.string(), enabled: z.boolean().default(true) }))
      .default([]),
  }),
} satisfies ExtensionManifest;

const nested = defineExtension<typeof nestedManifest>({
  manifest: nestedManifest,
  activate() {},
});

test('a defaulted field nested in an array is optional to author', () => {
  // Omitting `enabled` must typecheck — `tsc --noEmit` is the real assertion here.
  const configured = nested({ targets: [{ out: 'build/css' }] });
  expect(configured.overrides).toEqual({ targets: [{ out: 'build/css' }] });

  // And supplying it still works.
  expect(nested({ targets: [{ out: 'x', enabled: false }] }).overrides).toEqual(
    {
      targets: [{ out: 'x', enabled: false }],
    },
  );
});
