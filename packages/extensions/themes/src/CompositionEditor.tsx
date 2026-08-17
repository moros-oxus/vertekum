import {
  Button,
  Concertina,
  ConcertinaContent,
  ConcertinaHeader,
  ConcertinaItem,
  ConcertinaTrigger,
  Dialog,
  Select,
  TextInput,
} from '@vertekum-ui/react';
import { useId, useState } from 'react';
import {
  type Document,
  dtcg,
  type ResolverIssue,
  updateResolver,
  useResolvers,
  useSets,
} from 'vertekum';
import {
  type ContextEntry,
  type Entry,
  fromEntries,
  toEntries,
} from './composition-model';
import './CompositionEditor.css';

/** An entry tagged with a stable editor-local id, so rename/reorder never remount it. */
type DraftEntry = Entry & { id: string };

const withIds = (entries: Entry[]): DraftEntry[] =>
  entries.map((e, i) => ({ ...e, id: `e${i}` }));
const stripIds = (entries: DraftEntry[]): Entry[] =>
  entries.map(({ id: _, ...e }) => e as Entry);
const uniqueName = (base: string, taken: Set<string>): string => {
  let n = 1;
  let name = base;
  while (taken.has(name)) name = `${base}${++n}`;
  return name;
};

/** Small status dot on an entry header: red bar (error) / amber "i" (warning). Visual in CSS. */
function IssueBadge({ severity }: { severity: 'error' | 'warning' }) {
  return (
    <span
      data-vtk-comp-badge={severity}
      role="img"
      aria-label={severity === 'error' ? 'Has errors' : 'Has warnings'}
    />
  );
}

/** The severity summary appended to a read-mode entry body. */
function IssueSummary({ issues }: { issues: ResolverIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <ul data-vtk-comp-issues="">
      {issues.map((iss, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: issue rows are positional
        <li key={i} data-vtk-comp-issue={iss.severity}>
          {iss.message}
        </li>
      ))}
    </ul>
  );
}

/** Read-only summary of an entry's body. */
function EntryBody({
  entry,
  issues,
}: {
  entry: Entry;
  issues: ResolverIssue[];
}) {
  if (entry.kind === 'set') {
    return (
      <div data-vtk-comp-body="">
        {entry.description ? <p>{entry.description}</p> : null}
        <p data-vtk-comp-sublabel="">Sources</p>
        <ol>
          {entry.sources.map((s) => (
            <li key={s}>{s.replace(/\.json$/, '')}</li>
          ))}
        </ol>
        <IssueSummary issues={issues} />
      </div>
    );
  }
  return (
    <div data-vtk-comp-body="">
      {entry.description ? <p>{entry.description}</p> : null}
      <p data-vtk-comp-sublabel="">Contexts</p>
      <ul>
        {entry.contexts.map((c, i) => (
          <li key={c.name}>
            {c.name}
            {entry.default === c.name ||
            (entry.default === undefined && i === 0)
              ? ' (default)'
              : ''}
            : {c.sources.map((s) => s.replace(/\.json$/, '')).join(', ')}
          </li>
        ))}
      </ul>
      <IssueSummary issues={issues} />
    </div>
  );
}

/** An editable, reorderable list of source refs (each a `useSets` select). */
function SourceList({
  sources,
  sets,
  knownSetRefs,
  onChange,
}: {
  sources: string[];
  sets: string[];
  knownSetRefs: ReadonlySet<string>;
  onChange: (next: string[]) => void;
}) {
  const setAt = (i: number, v: string) =>
    onChange(sources.map((s, j) => (j === i ? v : s)));
  const moveSrc = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= sources.length) return;
    const next = [...sources];
    const a = next[i];
    const b = next[j];
    if (a !== undefined && b !== undefined) {
      next[i] = b;
      next[j] = a;
    }
    onChange(next);
  };
  return (
    <div data-vtk-comp-sources="">
      {sources.map((src, i) => {
        const bad = src !== '' && !knownSetRefs.has(src);
        return (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: source rows are positional
            key={i}
            data-vtk-comp-row=""
            data-vtk-invalid={bad ? '' : undefined}
          >
            <Select value={src} onChange={(e) => setAt(i, e.target.value)}>
              <option value="">— select set —</option>
              {sets.map((s) => (
                <option key={s} value={`${s}.json`}>
                  {s}
                </option>
              ))}
            </Select>
            <Button aria-label="Move source up" onClick={() => moveSrc(i, -1)}>
              ▲
            </Button>
            <Button aria-label="Move source down" onClick={() => moveSrc(i, 1)}>
              ▼
            </Button>
            <Button
              aria-label="Remove source"
              onClick={() => onChange(sources.filter((_, j) => j !== i))}
            >
              ✕
            </Button>
            {bad ? <span data-vtk-comp-rowmsg="">Unknown set</span> : null}
          </div>
        );
      })}
      <Button onClick={() => onChange([...sources, ''])}>Add source</Button>
    </div>
  );
}

/** The edit form for one entry (set or modifier) and its whole subtree. */
function EntryForm({
  entry,
  sets,
  knownSetRefs,
  upd,
}: {
  entry: DraftEntry;
  sets: string[];
  knownSetRefs: ReadonlySet<string>;
  upd: (fn: (e: DraftEntry) => DraftEntry) => void;
}) {
  const ids = useId();
  return (
    <div data-vtk-comp-form="">
      <label htmlFor={`${ids}-name`}>Name</label>
      <TextInput
        id={`${ids}-name`}
        value={entry.name}
        onChange={(e) => upd((x) => ({ ...x, name: e.target.value }))}
      />
      <label htmlFor={`${ids}-desc`}>Description</label>
      <TextInput
        id={`${ids}-desc`}
        value={entry.description ?? ''}
        onChange={(e) =>
          upd((x) => ({ ...x, description: e.target.value || undefined }))
        }
      />
      {entry.kind === 'set' ? (
        <>
          <p data-vtk-comp-sublabel="">Sources</p>
          <SourceList
            sources={entry.sources}
            sets={sets}
            knownSetRefs={knownSetRefs}
            onChange={(sources) =>
              upd((x) => (x.kind === 'set' ? { ...x, sources } : x))
            }
          />
        </>
      ) : (
        <>
          <p data-vtk-comp-sublabel="">Contexts</p>
          {entry.contexts.length === 0 ? (
            <p data-vtk-comp-issue="error">
              A modifier needs at least one context.
            </p>
          ) : null}
          {entry.contexts.map((c, i) => {
            const isDefault =
              entry.default === c.name ||
              (entry.default === undefined && i === 0);
            const setCtx = (fn: (c: ContextEntry) => ContextEntry) =>
              upd((x) =>
                x.kind === 'modifier'
                  ? {
                      ...x,
                      contexts: x.contexts.map((cc, j) =>
                        j === i ? fn(cc) : cc,
                      ),
                    }
                  : x,
              );
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: context rows are positional while editing
              <div key={i} data-vtk-comp-context="">
                <TextInput
                  value={c.name}
                  onChange={(e) =>
                    setCtx((cc) => ({ ...cc, name: e.target.value }))
                  }
                />
                <label>
                  <input
                    type="radio"
                    name={`default-${entry.id}`}
                    checked={isDefault}
                    onChange={() =>
                      upd((x) =>
                        x.kind === 'modifier' ? { ...x, default: c.name } : x,
                      )
                    }
                  />
                  default
                </label>
                <Button
                  aria-label="Remove context"
                  onClick={() =>
                    upd((x) =>
                      x.kind === 'modifier'
                        ? {
                            ...x,
                            contexts: x.contexts.filter((_, j) => j !== i),
                          }
                        : x,
                    )
                  }
                >
                  ✕
                </Button>
                <SourceList
                  sources={c.sources}
                  sets={sets}
                  knownSetRefs={knownSetRefs}
                  onChange={(sources) => setCtx((cc) => ({ ...cc, sources }))}
                />
              </div>
            );
          })}
          <Button
            onClick={() =>
              upd((x) =>
                x.kind === 'modifier'
                  ? {
                      ...x,
                      contexts: [
                        ...x.contexts,
                        {
                          name: uniqueName(
                            'context',
                            new Set(x.contexts.map((c) => c.name)),
                          ),
                          sources: [],
                        },
                      ],
                    }
                  : x,
              )
            }
          >
            Add context
          </Button>
        </>
      )}
    </div>
  );
}

/**
 * The composition editor: authors the selected resolver's sets/modifiers/contexts/sources. A local
 * draft buffers all edits; only Save/Update/Delete touch the document (one `updateResolver` +
 * `commitEdit` each — one undo step).
 */
export function CompositionEditor({
  document,
  name,
}: {
  document: Document;
  name: string;
}) {
  const resolvers = useResolvers(document);
  const doc = resolvers.get(name);
  const sets = useSets(document);
  const [draft, setDraft] = useState<DraftEntry[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [openName, setOpenName] = useState<Record<string, boolean>>({});
  const [pendingDelete, setPendingDelete] = useState(false);

  const readEntries = doc ? toEntries(doc) : [];
  const entries: DraftEntry[] = draft ?? withIds(readEntries);
  const editing = draft !== null;

  const startEdit = (id: string) => {
    setDraft(withIds(readEntries));
    setEditingId(id);
    setIsNew(false);
  };
  const addEntry = (kind: 'set' | 'modifier') => {
    const base = withIds(readEntries);
    const id = 'e-new';
    const nm = uniqueName(kind, new Set(base.map((e) => e.name)));
    const entry: DraftEntry =
      kind === 'set'
        ? { id, kind, name: nm, sources: [] }
        : { id, kind, name: nm, contexts: [] };
    setDraft([...base, entry]);
    setEditingId(id);
    setIsNew(true);
  };
  const patch = (id: string, fn: (e: DraftEntry) => DraftEntry) =>
    setDraft((d) => (d ? d.map((e) => (e.id === id ? fn(e) : e)) : d));
  const move = (id: string, dir: -1 | 1) =>
    setDraft((d) => {
      if (!d) return d;
      const i = d.findIndex((e) => e.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= d.length) return d;
      const next = [...d];
      const a = next[i];
      const b = next[j];
      if (a !== undefined && b !== undefined) {
        next[i] = b;
        next[j] = a;
      }
      return next;
    });
  const clear = () => {
    setDraft(null);
    setEditingId(null);
    setIsNew(false);
    setPendingDelete(false);
  };
  const commit = (finalEntries: DraftEntry[]) => {
    if (!doc) return;
    document.apply(
      updateResolver(name, fromEntries(stripIds(finalEntries), doc)),
    );
    document.commitEdit();
    clear();
  };
  const save = () => commit(entries);
  const remove = () => commit(entries.filter((e) => e.id !== editingId));

  const editingEntry = entries.find((e) => e.id === editingId);
  const nameOk =
    !!editingEntry &&
    editingEntry.name.trim() !== '' &&
    !entries.some((e) => e.id !== editingId && e.name === editingEntry.name) &&
    (editingEntry.kind !== 'modifier' ||
      editingEntry.contexts.every(
        (c, i, a) =>
          c.name.trim() !== '' && a.findIndex((x) => x.name === c.name) === i,
      ));

  const knownSetRefs = new Set(sets.map((s) => `${s}.json`));
  const prospective = doc
    ? draft
      ? fromEntries(stripIds(draft), doc)
      : doc
    : null;
  const issues = prospective
    ? dtcg.resolvers.validateResolver(prospective, knownSetRefs)
    : [];
  const issuesByName = new Map<string, ResolverIssue[]>();
  for (const iss of issues) {
    const key = iss.target?.name;
    if (key === undefined) continue;
    const list = issuesByName.get(key) ?? [];
    list.push(iss);
    issuesByName.set(key, list);
  }
  const worst = (n: string): 'error' | 'warning' | undefined => {
    const list = issuesByName.get(n);
    if (!list || list.length === 0) return undefined;
    return list.some((i) => i.severity === 'error') ? 'error' : 'warning';
  };
  const hasErrors = issues.some((i) => i.severity === 'error');
  const editWarnings = editingEntry
    ? (issuesByName.get(editingEntry.name) ?? []).filter(
        (i) => i.severity === 'warning',
      )
    : [];

  return (
    <div data-vtk-composition-editor="">
      <header data-vtk-comp-toolbar="">
        <Button disabled={editing} onClick={() => addEntry('set')}>
          Add set
        </Button>
        <Button disabled={editing} onClick={() => addEntry('modifier')}>
          Add modifier
        </Button>
      </header>
      <Concertina>
        {entries.map((entry) => {
          const isEditing = editing && entry.id === editingId;
          return (
            <ConcertinaItem
              key={entry.id}
              data-vtk-type={entry.kind}
              data-vtk-invalid={worst(entry.name)}
              open={isEditing ? true : (openName[entry.name] ?? false)}
              onOpenChange={
                isEditing
                  ? () => {}
                  : (next) => setOpenName((o) => ({ ...o, [entry.name]: next }))
              }
            >
              <ConcertinaHeader>
                {isEditing ? (
                  <>
                    <span data-vtk-comp-spacer="" />
                    <Button
                      aria-label="Move up"
                      onClick={() => move(entry.id, -1)}
                    >
                      ▲
                    </Button>
                    <Button
                      aria-label="Move down"
                      onClick={() => move(entry.id, 1)}
                    >
                      ▼
                    </Button>
                  </>
                ) : (
                  <>
                    <ConcertinaTrigger>▸</ConcertinaTrigger>
                    <span data-vtk-comp-name="">{entry.name}</span>
                    {(() => {
                      const w = worst(entry.name);
                      return w ? <IssueBadge severity={w} /> : null;
                    })()}
                    <span data-vtk-comp-spacer="" />
                    <Button
                      disabled={editing}
                      onClick={() => startEdit(entry.id)}
                    >
                      Edit
                    </Button>
                  </>
                )}
              </ConcertinaHeader>
              <ConcertinaContent>
                {isEditing ? (
                  <EntryForm
                    entry={entry}
                    sets={sets}
                    knownSetRefs={knownSetRefs}
                    upd={(fn) => patch(entry.id, fn)}
                  />
                ) : (
                  <EntryBody
                    entry={entry}
                    issues={issuesByName.get(entry.name) ?? []}
                  />
                )}
              </ConcertinaContent>
            </ConcertinaItem>
          );
        })}
      </Concertina>
      {editing && editWarnings.length > 0 ? (
        <div data-vtk-comp-warnings="">
          {editWarnings.map((iss, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: warning rows are positional
            <p key={i} data-vtk-comp-issue="warning">
              {iss.message}
            </p>
          ))}
        </div>
      ) : null}
      {editing ? (
        <footer data-vtk-comp-footer="">
          {!isNew ? (
            <Button variant="danger" onClick={() => setPendingDelete(true)}>
              Delete
            </Button>
          ) : null}
          <span data-vtk-comp-spacer="" />
          <Button variant="secondary" onClick={clear}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!nameOk || hasErrors}
            onClick={save}
          >
            {isNew ? 'Save' : 'Update'}
          </Button>
        </footer>
      ) : null}
      {pendingDelete ? (
        <Dialog
          open
          onClose={() => setPendingDelete(false)}
          title="Delete item"
        >
          <p>Delete "{editingEntry?.name}"? This is undoable.</p>
          <div data-vtk-dialog-actions="">
            <Button variant="danger" onClick={remove}>
              Delete
            </Button>
            <Button onClick={() => setPendingDelete(false)}>Cancel</Button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
