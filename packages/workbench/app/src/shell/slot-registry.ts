import type { SlotContribution, SlotRegistry } from './ui-contribution';

// Persistent chrome only (ADR-0022). sidebar/panel belong to whichever route owns them.
const BASE_SLOTS = ['ribbon', 'toolbar', 'main', 'statusBar'];

export function createSlotRegistry(): SlotRegistry {
  const slots = new Map<string, SlotContribution[]>();
  for (const id of BASE_SLOTS) slots.set(id, []);

  return {
    defineSlot(slotId) {
      if (!slots.has(slotId)) slots.set(slotId, []);
    },
    hasSlot(slotId) {
      return slots.has(slotId);
    },
    contribute(slotId, contribution) {
      const list = slots.get(slotId);
      if (!list) throw new Error(`unknown slot: ${slotId}`);
      list.push(contribution);
    },
    getContributions(slotId) {
      return slots.get(slotId) ?? [];
    },
  };
}
