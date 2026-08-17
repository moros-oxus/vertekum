import type { ValueEditorProps } from '@vertekum/ext-value-editors';

/**
 * Consumer-owned fallback editor: a plain text field. Used when no editor is registered for a
 * $type and for reference values (`{…}`), so editing degrades gracefully even if the
 * value-editors extension is absent (ADR-0023).
 */
export function TextEditor({ value, onCommit }: ValueEditorProps) {
  const v = value == null ? '' : String(value);
  return (
    <input
      type="text"
      value={v}
      spellCheck={false}
      onChange={(e) => onCommit(e.target.value)}
      aria-label="Value"
    />
  );
}
