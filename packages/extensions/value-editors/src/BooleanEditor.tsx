import type { ValueEditorProps } from './value-editor';

/** boolean primitive (non-DTCG $type): a checkbox committing a boolean. */
export function BooleanEditor({ value, onCommit }: ValueEditorProps) {
  return (
    <input
      type="checkbox"
      checked={value === true}
      onChange={(e) => onCommit(e.target.checked)}
      aria-label="Boolean"
    />
  );
}
