import { describe, expect, test } from 'vitest';
import { z } from 'zod';
import { ExtensionManifestSchema } from './manifest';

describe('ExtensionManifestSchema', () => {
  test('accepts a minimal valid manifest', () => {
    const result = ExtensionManifestSchema.safeParse({
      id: 'vtk.tokens',
      name: 'Tokens',
    });
    expect(result.success).toBe(true);
  });

  test('accepts a Zod schema in settings and onStartup activation', () => {
    const result = ExtensionManifestSchema.safeParse({
      id: 'vtk.tokens',
      name: 'Tokens',
      settings: z.object({ showIds: z.boolean().default(false) }),
      activation: ['onStartup'],
    });
    expect(result.success).toBe(true);
  });

  test('rejects a manifest missing an id', () => {
    expect(ExtensionManifestSchema.safeParse({ name: 'Tokens' }).success).toBe(
      false,
    );
  });

  test('rejects an unknown activation event', () => {
    const result = ExtensionManifestSchema.safeParse({
      id: 'x',
      name: 'X',
      activation: ['onLoad'],
    });
    expect(result.success).toBe(false);
  });

  test('rejects a non-Zod settings value', () => {
    const result = ExtensionManifestSchema.safeParse({
      id: 'x',
      name: 'X',
      settings: { not: 'a zod schema' },
    });
    expect(result.success).toBe(false);
  });

  test('accepts an optional description', () => {
    const result = ExtensionManifestSchema.safeParse({
      id: 'vtk.stats',
      name: 'Token Stats',
      description: 'Publishes live token counts.',
    });
    expect(result.success).toBe(true);
  });

  test('rejects a non-string description', () => {
    const result = ExtensionManifestSchema.safeParse({
      id: 'x',
      name: 'X',
      description: 42,
    });
    expect(result.success).toBe(false);
  });
});
