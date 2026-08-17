import type { ValueEditorProps } from './value-editor';

/** number $type: a numeric input. Commits a number, or '' when cleared. */
export function NumberEditor({ value, onCommit }: ValueEditorProps) {
  const v = value == null || value === '' ? '' : String(value);
  return (
    <input
      type="number"
      value={v}
      onChange={(e) =>
        onCommit(e.target.value === '' ? '' : Number(e.target.value))
      }
      aria-label="Number"
    />
  );
}
