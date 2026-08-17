import { useId, useState } from 'react';
import type { VtkComponentProps } from '../../types';
import { type ConcertinaItemContext, ItemContext } from './useConcertinaItem';
import './ConcertinaItem.css';

/**
 * `open` is the initial (uncontrolled) state — reflected to `data-vtk-open`, mirroring `<details open>`.
 * Pass `onOpenChange` to make it **controlled**: `open` then reflects the prop and the trigger calls
 * `onOpenChange(!open)` for the parent to update. (Named `onOpenChange`, not `onToggle`, to avoid the
 * native `ontoggle` / `ToggleEvent` handler on the element.)
 */
export type ConcertinaItemProps = VtkComponentProps<
  'vtk-concertina-item',
  { open?: boolean; onOpenChange?: (next: boolean) => void }
>;

function ConcertinaItem({
  open: openProp = false,
  onOpenChange,
  children,
  ...rest
}: ConcertinaItemProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(openProp);
  const controlled = onOpenChange !== undefined;
  const open = controlled ? openProp : uncontrolledOpen;
  const contentId = useId();
  const ctx: ConcertinaItemContext = {
    open,
    toggle: () =>
      controlled ? onOpenChange(!open) : setUncontrolledOpen((o) => !o),
    contentId,
  };
  return (
    <ItemContext.Provider value={ctx}>
      <vtk-concertina-item data-vtk-open={open ? '' : undefined} {...rest}>
        {children}
      </vtk-concertina-item>
    </ItemContext.Provider>
  );
}

export default ConcertinaItem;
