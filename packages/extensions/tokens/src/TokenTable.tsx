import { Button, Dialog } from '@vertekum-ui/react';
import { useState } from 'react';
import { dtcg, type Token } from 'vertekum';
import './TokenTable.css';

function display(value: unknown): string {
  return value == null || value === '' ? '—' : String(value);
}

/**
 * A table of a set's tokens for the selected theme: name (row header), the raw value as-entered (a
 * reference shows verbatim, e.g. `{color.brand}`), its resolved value (references dereferenced via the
 * path index), and per-row Edit + Delete. Editing lives in the panel (buffered draft → `replaceToken`,
 * ADR-0028); delete goes through a confirm dialog and is undoable.
 */
export function TokenTable({
  tokens,
  density,
  showIds,
  byPath,
  onEdit,
  onDelete,
}: {
  tokens: Token[];
  density: 'comfortable' | 'compact';
  showIds: boolean;
  byPath: Map<string, Token>;
  onEdit: (token: Token) => void;
  onDelete: (id: string) => void;
}) {
  const [pendingDelete, setPendingDelete] = useState<Token | null>(null);

  return (
    <>
      <table className="vtk-token-table" data-vtk-density={density}>
        <thead>
          <tr>
            <th scope="col">Token</th>
            <th scope="col">Value</th>
            <th scope="col">Resolved</th>
            <th scope="col">
              <span className="vtk-visually-hidden">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((token) => (
            <tr key={token.id}>
              <th scope="row">
                {token.path.join('.')}
                {showIds ? (
                  <span className="vtk-token-id"> {token.id}</span>
                ) : null}
              </th>
              <td>{display(token.value)}</td>
              <td>{display(dtcg.tokens.resolveValue(token, byPath))}</td>
              <td className="vtk-token-actions">
                <Button onClick={() => onEdit(token)}>Edit</Button>
                <Button
                  aria-label={`Delete ${token.path.join('.')}`}
                  onClick={() => setPendingDelete(token)}
                >
                  Delete
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {pendingDelete ? (
        <Dialog
          open
          onClose={() => setPendingDelete(null)}
          title="Delete token"
        >
          <p>
            Delete token "{pendingDelete.path.join('.')}"? This is undoable.
          </p>
          <div data-vtk-dialog-actions="">
            <Button
              onClick={() => {
                onDelete(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              Delete
            </Button>
            <Button onClick={() => setPendingDelete(null)}>Cancel</Button>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}
