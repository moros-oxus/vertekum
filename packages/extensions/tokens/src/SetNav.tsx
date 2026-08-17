import { Button, Dialog, TextInput } from '@vertekum-ui/react';
import { useId, useState } from 'react';
import './SetNav.css';

/**
 * Presentational token-set nav (set = file): lists sets with select + delete, an add-set dialog, and a
 * delete-set confirm dialog. Document-ignorant — the route wires the callbacks to addSet/removeSet.
 */
export function SetNav({
  sets,
  activeSet,
  onSelect,
  onAdd,
  onDelete,
}: {
  sets: string[];
  activeSet: string | null;
  onSelect: (set: string) => void;
  onAdd: (name: string) => void;
  onDelete: (name: string) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const nameId = useId();

  const trimmed = name.trim();
  const canCreate = trimmed !== '' && !sets.includes(trimmed);
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
    <nav aria-label="Token sets" data-vtk-setnav>
      <ul>
        {sets.map((set) => (
          <li key={set}>
            <button
              type="button"
              data-vtk-active={set === activeSet ? '' : undefined}
              onClick={() => onSelect(set)}
            >
              {set}
            </button>
            <button
              type="button"
              data-vtk-set-delete=""
              aria-label={`Delete set ${set}`}
              onClick={() => setPendingDelete(set)}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        data-vtk-set-add=""
        onClick={() => setAddOpen(true)}
      >
        New set
      </button>

      {addOpen ? (
        <Dialog open onClose={closeAdd} title="New set">
          <label htmlFor={nameId}>Set name</label>
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
        <Dialog open onClose={() => setPendingDelete(null)} title="Delete set">
          <p>Delete set "{pendingDelete}"? Its tokens will be removed.</p>
          <div data-vtk-dialog-actions="">
            <Button onClick={confirmDelete}>Delete</Button>
            <Button onClick={() => setPendingDelete(null)}>Cancel</Button>
          </div>
        </Dialog>
      ) : null}
    </nav>
  );
}
