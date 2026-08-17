import './ColorEditor.css';
import type { ValueEditorProps } from './value-editor';

/** color $type: native picker + hex text. Non-string values render blank (ADR-0028). */
export function ColorEditor({ value, onCommit }: ValueEditorProps) {
  const v = typeof value === 'string' ? value : '';
  return (
    <span className="vtk-color-field">
      <input
        type="color"
        value={v}
        onChange={(e) => onCommit(e.target.value)}
        aria-label="Color"
      />
      <input
        type="text"
        value={v}
        spellCheck={false}
        onChange={(e) => onCommit(e.target.value)}
        aria-label="Hex value"
      />
    </span>
  );
}
