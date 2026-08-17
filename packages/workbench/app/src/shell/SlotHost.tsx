import type { Kernel } from '@vertekum/core';
import { useEffect, useRef } from 'react';
import type { SlotRegistry } from './ui-contribution';

/**
 * Renders a shell slot by mounting each contribution through the framework-agnostic
 * mount(element, context) contract (ADR-0016, ADR-0017). Uses a custom element tag for
 * structure (ADR-0021). The `id` prop is the slot name; it is carried as `data-vtk-slot`
 * (styling/selection hook) — no DOM `id` is set, since nothing references this node uniquely
 * (identity-on-demand, ADR-0021). Contributions get `data-vtk-contribution`.
 */
export function SlotHost({
  id,
  kernel,
  slots,
}: {
  id: string;
  kernel: Kernel;
  slots: SlotRegistry;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;

    const context = kernel.context;
    const cleanups: Array<() => void> = [];

    for (const contribution of slots.getContributions(id)) {
      const el = document.createElement('vtk-contribution');
      el.setAttribute('data-vtk-contribution', contribution.id);
      host.appendChild(el);
      const cleanup = contribution.mount(el, context);
      if (cleanup) cleanups.push(cleanup);
    }

    return () => {
      for (const cleanup of cleanups) cleanup();
      host.replaceChildren();
    };
  }, [id, kernel, slots]);

  return <vtk-slot-host data-vtk-slot={id} ref={ref} />;
}
