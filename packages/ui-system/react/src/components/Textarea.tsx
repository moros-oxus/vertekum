import type { TextareaHTMLAttributes } from 'react';
import './Textarea.css';

/** Atomic `<textarea>` wrapper. Thin native pass-through. */
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea data-vtk-textarea="" {...props} />;
}
