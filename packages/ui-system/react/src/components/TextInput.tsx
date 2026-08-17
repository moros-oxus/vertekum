import type { InputHTMLAttributes } from 'react';
import './TextInput.css';

/** Atomic text `<input>` wrapper (type fixed to `"text"`). Thin native pass-through. */
export function TextInput(
  props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>,
) {
  return <input type="text" data-vtk-input="" {...props} />;
}
