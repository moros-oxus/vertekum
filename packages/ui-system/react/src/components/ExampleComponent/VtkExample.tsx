import type { VtkComponentProps } from '../../types';
import './VtkExample.css';

/**
 * Direct interfaces stay co-located to source, unless they create a circular dependency.
 */
export type VtkExampleProps = VtkComponentProps<'vtk-example'>;

/**
 * An example component (root)
 */
function VtkExample(props: VtkExampleProps) {
  return <vtk-example {...props}></vtk-example>;
}

export default VtkExample;
