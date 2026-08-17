import type { VtkComponentProps } from '../../types';

/**
 * Direct interfaces stay co-located to source, unless they create a circular dependency.
 */
export type VtkExampleContentProps = VtkComponentProps<
  'vtk-example-content',
  {
    type?: HTMLButtonElement['type'];
  },
  'button'
>;

/**
 * The component.
 */
function VtkExampleContent({
  ref,
  type = 'button',
  ...props
}: VtkExampleContentProps) {
  return (
    <vtk-example-content {...props}>
      <button type={type} ref={ref}>
        ☕︎
      </button>
    </vtk-example-content>
  );
}

export default VtkExampleContent;
