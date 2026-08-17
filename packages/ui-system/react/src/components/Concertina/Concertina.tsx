import type { VtkComponentProps } from '../../types';
import './Concertina.css';

/** A concertina — a list of independently collapsible items. Roles are the consumer's to add. */
export type ConcertinaProps = VtkComponentProps<'vtk-concertina'>;

function Concertina(props: ConcertinaProps) {
  return <vtk-concertina {...props} />;
}

export default Concertina;
