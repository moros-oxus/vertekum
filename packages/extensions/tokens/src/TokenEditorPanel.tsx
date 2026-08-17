import type { ValueEditorService } from '@vertekum/ext-value-editors';
import { ValueField } from '@vertekum/ext-value-editors/ui';
import {
  Button,
  Dialog,
  Select,
  Textarea,
  TextInput,
} from '@vertekum-ui/react';
import { useId, useMemo, useState } from 'react';
import type { Token } from 'vertekum';
import {
  type ReferenceIssue,
  referenceCandidates,
  validateReference,
} from './resolve-value';
import './TokenEditorPanel.css';

/** DTCG standard `$type`s offered in the Type select (unknown types still fall back to text). */
const DTCG_TYPES = [
  'color',
  'dimension',
  'fontFamily',
  'fontWeight',
  'duration',
  'cubicBezier',
  'number',
  'strokeStyle',
  'border',
  'transition',
  'shadow',
  'gradient',
  'typography',
  'boolean',
];

/**
 * The disclosed Token Editor: a modal editing a **buffered draft** of the token. Nothing touches the
 * document until Save, which hands the whole draft back via `onSave` (applied as one `replaceToken`).
 * Edits base value / type / reference / description. Any `vtk`/`extensions` data (e.g. preserved
 * `vtk.meta`) rides through untouched. `id` is never editable.
 */
export function TokenEditorPanel({
  token,
  mode = 'edit',
  valueEditors,
  byPath,
  onSave,
  onCancel,
}: {
  token: Token;
  mode?: 'create' | 'edit';
  valueEditors?: ValueEditorService;
  byPath: Map<string, Token>;
  onSave: (next: Token) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Token>(token);
  const ids = useId();
  const nameId = `${ids}-name`;
  const typeId = `${ids}-type`;
  const descId = `${ids}-desc`;

  const pathStr = draft.path.join('.');

  // Same-`$type` reference candidates for the datalist.
  const refCandidates = useMemo(
    () => referenceCandidates([...byPath.values()], draft.type, draft.id),
    [byPath, draft.type, draft.id],
  );

  const refMessage = (e: ReferenceIssue): string =>
    e === 'dangling'
      ? 'No token at this path'
      : e === 'cycle'
        ? 'Reference forms a cycle'
        : `Target is not a ${draft.type}`;

  const valueRefError = validateReference(
    draft.value,
    draft.type,
    draft.id,
    byPath,
  );

  // The full dotted path is the name; every segment must be non-empty.
  const nameOk =
    draft.path.length > 0 && draft.path.every((s) => s.trim() !== '');
  const typeOk = draft.type.trim() !== '';
  const valueOk = draft.value != null && String(draft.value).trim() !== '';
  const canSave = nameOk && typeOk && valueOk && valueRefError === null;

  const nameError = nameOk ? undefined : 'Required';
  const valueError = valueRefError
    ? refMessage(valueRefError)
    : valueOk
      ? undefined
      : 'Required';

  const typeOptions = DTCG_TYPES.includes(draft.type)
    ? DTCG_TYPES
    : [draft.type, ...DTCG_TYPES];

  const save = () => {
    const next: Token = { ...draft };
    if (!next.description || next.description.trim() === '') {
      delete next.description;
    }
    onSave(next);
  };

  return (
    <Dialog
      open
      onClose={onCancel}
      title={mode === 'create' ? 'Add token' : `Edit ${draft.path.join('.')}`}
    >
      <div data-vtk-token-editor="">
        <div data-vtk-field-grid="">
          <label data-vtk-field="" htmlFor={nameId}>
            <span data-vtk-field-label="">
              Name<abbr title="required">*</abbr>
            </span>
            <TextInput
              id={nameId}
              value={pathStr}
              placeholder="color.brand.primary"
              spellCheck={false}
              aria-invalid={nameError ? true : undefined}
              data-vtk-invalid={nameError ? '' : undefined}
              onChange={(e) =>
                setDraft((d) => ({ ...d, path: e.target.value.split('.') }))
              }
            />
            {nameError ? (
              <span data-vtk-field-error="" role="alert">
                {nameError}
              </span>
            ) : null}
          </label>
          <label data-vtk-field="" htmlFor={typeId}>
            <span data-vtk-field-label="">
              Type<abbr title="required">*</abbr>
            </span>
            <Select
              id={typeId}
              value={draft.type}
              onChange={(e) =>
                setDraft((d) => ({ ...d, type: e.target.value }))
              }
            >
              {typeOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </label>
          <div data-vtk-field="">
            <span data-vtk-field-label="">
              Value<abbr title="required">*</abbr>
            </span>
            <ValueField
              value={draft.value}
              type={draft.type}
              onChange={(v) => setDraft((d) => ({ ...d, value: v }))}
              valueEditors={valueEditors}
              candidates={refCandidates}
              error={valueError}
            />
          </div>
          <label data-vtk-field="" htmlFor={descId}>
            <span data-vtk-field-label="">Description</span>
            <Textarea
              id={descId}
              value={draft.description ?? ''}
              onChange={(e) =>
                setDraft((d) => ({ ...d, description: e.target.value }))
              }
            />
          </label>
        </div>
        <div data-vtk-panel-actions="">
          <Button onClick={onCancel}>Cancel</Button>
          <Button onClick={save} disabled={!canSave}>
            Save
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
