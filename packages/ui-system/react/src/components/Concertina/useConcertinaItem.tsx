import { createContext, useContext } from 'react';

export interface ConcertinaItemContext {
  open: boolean;
  toggle: () => void;
  contentId: string;
}

export const ItemContext = createContext<ConcertinaItemContext | null>(null);

/** Access the enclosing item's disclosure state. Throws outside a `ConcertinaItem`. */
export function useConcertinaItem(): ConcertinaItemContext {
  const ctx = useContext(ItemContext);
  if (!ctx) {
    throw new Error(
      'ConcertinaTrigger/ConcertinaContent must be used within a ConcertinaItem',
    );
  }
  return ctx;
}
