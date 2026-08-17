import type { ValueEditorProps } from './value-editor';

/** dimension $type: a text field for a number+unit string, e.g. `16px`. */
export function DimensionEditor({ value, onCommit }: ValueEditorProps) {
  const v = value == null ? '' : String(value);
  return (
    <input
      type="text"
      value={v}
      spellCheck={false}
      placeholder="e.g. 16px"
      onChange={(e) => onCommit(e.target.value)}
      aria-label="Dimension"
    />
  );
}
