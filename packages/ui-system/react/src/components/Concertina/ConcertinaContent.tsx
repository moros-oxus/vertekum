import type { VtkComponentProps } from '../../types';
import { useConcertinaItem } from './useConcertinaItem';
import './ConcertinaContent.css';

/** The region — always rendered; open/closed is expressed in styling via the item's `data-vtk-open`. */
export type ConcertinaContentProps =
  VtkComponentProps<'vtk-concertina-content'>;

function ConcertinaContent({ children, ...props }: ConcertinaContentProps) {
  const { contentId } = useConcertinaItem();
  return (
    <vtk-concertina-content {...props} id={contentId}>
      {children}
    </vtk-concertina-content>
  );
}

export default ConcertinaContent;
