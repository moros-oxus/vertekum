import type { SelectHTMLAttributes } from 'react';
import './Select.css';

/** Atomic `<select>` wrapper; `children` are the `<option>`s. Thin native pass-through. */
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select data-vtk-select="" {...props} />;
}
