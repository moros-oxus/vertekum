import { Button, Dialog, TextInput } from '@vertekum-ui/react';
import { useId, useState } from 'react';
import './CompositionNav.css';

/**
 * Presentational composition nav (front-facing "composition"; a composition = a resolver document):
 * lists compositions with select + delete, a New-composition dialog, and a delete-confirm dialog.
 * Document-ignorant — the route wires the callbacks to addResolver/removeResolver.
 */
export function CompositionNav({
  names,
  active,
  onSelect,
  onAdd,
  onDelete,
}: {
  names: string[];
  active: string | null;
  onSelect: (name: string) => void;
  onAdd: (name: string) => void;
  onDelete: (name: string) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const nameId = useId();

  const trimmed = name.trim();
  const canCreate = trimmed !== '' && !names.includes(trimmed);
  const closeAdd = () => {
    setAddOpen(false);
    setName('');
  };
  const create = () => {
    onAdd(trimmed);
    closeAdd();
  };
  const confirmDelete = () => {
    if (pendingDelete) onDelete(pendingDelete);
    setPendingDelete(null);
  };

  return (
    <nav aria-label="Compositions" data-vtk-compnav>
      <ul>
        {names.map((n) => (
          <li key={n}>
            <button
              type="button"
              data-vtk-active={n === active ? '' : undefined}
              onClick={() => onSelect(n)}
            >
              {n}
            </button>
            <button
              type="button"
              data-vtk-comp-delete=""
              aria-label={`Delete composition ${n}`}
              onClick={() => setPendingDelete(n)}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        data-vtk-comp-add=""
        onClick={() => setAddOpen(true)}
      >
        New composition
      </button>

      {addOpen ? (
        <Dialog open onClose={closeAdd} title="New composition">
          <label htmlFor={nameId}>Composition name</label>
          <TextInput
            id={nameId}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div data-vtk-dialog-actions="">
            <Button onClick={create} disabled={!canCreate}>
              Create
            </Button>
            <Button onClick={closeAdd}>Cancel</Button>
          </div>
        </Dialog>
      ) : null}

      {pendingDelete !== null ? (
        <Dialog
          open
          onClose={() => setPendingDelete(null)}
          title="Delete composition"
        >
          <p>
            Delete composition "{pendingDelete}"? This removes its resolver
            file.
          </p>
          <div data-vtk-dialog-actions="">
            <Button onClick={confirmDelete}>Delete</Button>
            <Button onClick={() => setPendingDelete(null)}>Cancel</Button>
          </div>
        </Dialog>
      ) : null}
    </nav>
  );
}
