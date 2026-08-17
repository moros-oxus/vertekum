import type { VtkComponentProps } from '../../types';
import { useConcertinaItem } from './useConcertinaItem';
import './ConcertinaTrigger.css';

/** The disclosure control — a native `<button>` wired to the item's open state. */
export type ConcertinaTriggerProps = VtkComponentProps<'button'>;

function ConcertinaTrigger({ children, ...props }: ConcertinaTriggerProps) {
  const { open, toggle, contentId } = useConcertinaItem();
  return (
    <button
      {...props}
      type="button"
      data-vtk-concertina-trigger=""
      aria-expanded={open}
      aria-controls={contentId}
      onClick={toggle}
    >
      {children}
    </button>
  );
}

export default ConcertinaTrigger;
