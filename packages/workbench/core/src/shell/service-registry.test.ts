import { describe, expect, test } from 'vitest';
import { createServiceRegistry } from './service-registry';

describe('service registry', () => {
  test('register then get returns the same service', () => {
    const services = createServiceRegistry();
    const svc = { hello: () => 'hi' };

    services.register('themes', svc);

    expect(services.get('themes')).toBe(svc);
  });

  test('get returns undefined for an unknown key (optional dependency)', () => {
    expect(createServiceRegistry().get('nope')).toBeUndefined();
  });
});
