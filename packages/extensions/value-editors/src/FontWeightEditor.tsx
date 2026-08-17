import type { ValueEditorProps } from './value-editor';

const WEIGHTS = ['100', '200', '300', '400', '500', '600', '700', '800', '900'];

/** fontWeight $type: a select of numeric weights. Commits a number for numeric options. */
export function FontWeightEditor({ value, onCommit }: ValueEditorProps) {
  const v = value == null ? '' : String(value);
  const options = v === '' || WEIGHTS.includes(v) ? WEIGHTS : [v, ...WEIGHTS];
  return (
    <select
      value={v}
      onChange={(e) => {
        const s = e.target.value;
        onCommit(/^\d+$/.test(s) ? Number(s) : s);
      }}
      aria-label="Font weight"
    >
      {v === '' ? (
        <option value="" disabled>
          Select…
        </option>
      ) : null}
      {options.map((w) => (
        <option key={w} value={w}>
          {w}
        </option>
      ))}
    </select>
  );
}
