import type { VtkComponentProps } from '../../types';

/**
 * Direct interfaces stay co-located to source, unless they create a circular dependency.
 */
export type VtkExampleHeaderProps = VtkComponentProps<
  'vtk-example-header',
  {
    /** a variant of the header */
    variant?: string;
  }
>;

/**
 * The component.
 */
function VtkExampleHeader({ variant, ...props }: VtkExampleHeaderProps) {
  return <vtk-example-header {...props}></vtk-example-header>;
}

export default VtkExampleHeader;
