import { describe, expect, test } from 'vitest';
import { createSlotRegistry } from './slot-registry';

const noopMount = () => {};

describe('slot registry', () => {
  test('base chrome slots exist', () => {
    const slots = createSlotRegistry();

    for (const id of ['ribbon', 'toolbar', 'main', 'statusBar']) {
      expect(slots.hasSlot(id)).toBe(true);
    }
  });

  test('sidebar and panel are not base slots (routes own them)', () => {
    const slots = createSlotRegistry();

    expect(slots.hasSlot('sidebar')).toBe(false);
    expect(slots.hasSlot('panel')).toBe(false);
  });

  test('contribute then read contributions in order', () => {
    const slots = createSlotRegistry();

    slots.contribute('ribbon', { id: 'tree', mount: noopMount });
    slots.contribute('ribbon', { id: 'search', mount: noopMount });

    expect(slots.getContributions('ribbon').map((c) => c.id)).toEqual([
      'tree',
      'search',
    ]);
  });

  test('contributing to an unknown slot throws', () => {
    const slots = createSlotRegistry();

    expect(() =>
      slots.contribute('nope', { id: 'x', mount: noopMount }),
    ).toThrow(/unknown slot/i);
  });

  test('defineSlot registers a new namespaced slot', () => {
    const slots = createSlotRegistry();

    slots.defineSlot('themes.axisPanel');

    expect(slots.hasSlot('themes.axisPanel')).toBe(true);
  });
});
