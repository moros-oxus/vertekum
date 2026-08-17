import { Button, TextInput } from '@vertekum-ui/react';
import { lazy, Suspense, useId, useMemo, useState } from 'react';
import { dtcg } from 'vertekum';
import { pathToReference } from './references';
import type { ValueEditorService } from './value-editor';
import './ValueField.css';

/**
 * The split value/reference control (ADR-0028): the left side edits the value with the resolved
 * per-`$type` editor; a toggle on the right flips to **reference** mode — a `<datalist>` autocomplete
 * over `candidates` (same-`$type` token paths supplied by the panel). The input shows/accepts the
 * **bare path**; the stored value is a `{path}` string. `error` (a human-readable message from the
 * panel's validation) marks the field invalid. Value mode with no registered editor for the type
 * falls back to the text field. Reused for the default value and every theme override.
 */
export function ValueField({
  value,
  type,
  onChange,
  valueEditors,
  candidates,
  error,
}: {
  value: unknown;
  type: string;
  onChange: (next: unknown) => void;
  valueEditors?: ValueEditorService;
  candidates?: string[];
  error?: string;
}) {
  const [mode, setMode] = useState<'value' | 'reference'>(
    dtcg.tokens.isReference(value) ? 'reference' : 'value',
  );
  const listId = useId();

  // The registry resolves to a LOADER, not a component (ADR-0029): the editor module is fetched on
  // first render. `lazy` is memoized per loader so re-renders don't remount the editor.
  const loader = mode === 'value' ? valueEditors?.resolve(type) : undefined;
  const Editor = useMemo(() => (loader ? lazy(loader) : undefined), [loader]);
  const hasCandidates = candidates != null && candidates.length > 0;

  // Show the bare path only when the value is genuinely a reference; a literal (e.g. a hex) shows
  // as an empty reference field and is left untouched in the draft until a path is actually typed.
  const refText = dtcg.tokens.referenceToPath(value);

  return (
    <span data-vtk-value-field="" data-vtk-invalid={error ? '' : undefined}>
      <span data-vtk-value-field-row="">
        <span data-vtk-value-field-control="">
          {mode === 'reference' ? (
            <>
              <TextInput
                list={hasCandidates ? listId : undefined}
                value={refText}
                placeholder="token.path"
                spellCheck={false}
                aria-label="Reference"
                aria-invalid={error ? true : undefined}
                data-vtk-invalid={error ? '' : undefined}
                onChange={(e) => onChange(pathToReference(e.target.value))}
              />
              {hasCandidates ? (
                <datalist id={listId}>
                  {candidates.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              ) : null}
            </>
          ) : Editor ? (
            <Suspense fallback={null}>
              <Editor value={value} onCommit={onChange} />
            </Suspense>
          ) : (
            <TextInput
              value={value == null ? '' : String(value)}
              spellCheck={false}
              aria-label="Value"
              onChange={(e) => onChange(e.target.value)}
            />
          )}
        </span>
        <Button
          aria-pressed={mode === 'reference'}
          aria-label="Edit as reference"
          title="Reference"
          onClick={() => {
            if (mode === 'reference') {
              // Leaving reference mode: drop a reference so the value editor is never fed a
              // `{…}` string — it starts empty (and reads as required) for a fresh literal.
              if (dtcg.tokens.isReference(value)) onChange('');
              setMode('value');
            } else {
              setMode('reference');
            }
          }}
        >
          {'{}'}
        </Button>
      </span>
      {error ? (
        <span data-vtk-value-field-error="" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}
