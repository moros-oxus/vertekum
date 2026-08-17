import { expect, test, vi } from 'vitest';
import type { Exporter } from './exporter';
import { createExporterRegistry } from './registry';

const stub = (id: string): Exporter => ({ id, name: id, transform: () => [] });

test('register / get / list (stable snapshot, invalidated on register) + subscribe', () => {
  const r = createExporterRegistry();
  const listener = vi.fn();
  r.subscribe(listener);
  r.register(stub('css'));
  expect(listener).toHaveBeenCalledTimes(1);
  const first = r.list();
  expect(first.map((e) => e.id)).toEqual(['css']);
  expect(r.list()).toBe(first); // stable between registrations
  expect(r.get('css')?.name).toBe('css');
  r.register(stub('json'));
  expect(r.list().map((e) => e.id)).toEqual(['css', 'json']);
});
