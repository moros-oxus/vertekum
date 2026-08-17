import type { VtkComponentProps } from '../../types';
import './ConcertinaHeader.css';

/** The item's header row: holds the trigger plus any consumer controls (reorder/remove). */
export type ConcertinaHeaderProps = VtkComponentProps<'vtk-concertina-header'>;

function ConcertinaHeader(props: ConcertinaHeaderProps) {
  return <vtk-concertina-header {...props} />;
}

export default ConcertinaHeader;
