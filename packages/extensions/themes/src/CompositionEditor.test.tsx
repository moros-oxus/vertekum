// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { type Document, emptyResolver, type ResolverDocument } from 'vertekum';
import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import { CompositionEditor } from './CompositionEditor';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.open = false;
  };
});
afterEach(cleanup);

// getResolvers/getSets are useSyncExternalStore snapshots — they MUST return stable refs between
// changes (rebuilt only inside apply), else React loops.
function fakeDoc(initial: ResolverDocument = emptyResolver()) {
  let resolvers = new Map([['acme', initial]]);
  const setsSnap = ['palette', 'dark'];
  const listeners = new Set<() => void>();
  const doc = {
    apply: vi.fn((cmd: { type: string; doc: ResolverDocument }) => {
      if (cmd.type === 'updateResolver')
        resolvers = new Map([['acme', cmd.doc]]);
      for (const l of listeners) l();
    }),
    commitEdit: vi.fn(),
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getResolvers: () => resolvers,
    getSets: () => setsSnap,
  } as unknown as Document;
  return doc;
}
const applied = (doc: Document) =>
  (doc.apply as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
    type: string;
    doc: ResolverDocument;
  };

const withSet = (): ResolverDocument => ({
  version: '2025.10',
  sets: { core: { sources: [{ $ref: 'palette.json' }] } },
  modifiers: {},
  resolutionOrder: [{ $ref: '#/sets/core' }],
});

test('Add set → Save applies one updateResolver + commitEdit and returns to read mode', () => {
  const doc = fakeDoc();
  render(<CompositionEditor document={doc} name="acme" />);
  fireEvent.click(screen.getByRole('button', { name: 'Add set' }));
  expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(doc.apply).toHaveBeenCalledTimes(1);
  expect(doc.commitEdit).toHaveBeenCalledTimes(1);
  const cmd = applied(doc);
  expect(cmd.type).toBe('updateResolver');
  expect(cmd.doc.resolutionOrder).toEqual([{ $ref: '#/sets/set' }]);
  expect(cmd.doc.sets.set).toEqual({ sources: [] });
  expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
});

test('Cancel on a new item discards it (no apply)', () => {
  const doc = fakeDoc();
  render(<CompositionEditor document={doc} name="acme" />);
  fireEvent.click(screen.getByRole('button', { name: 'Add set' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(doc.apply).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Add set' })).toBeTruthy();
});

test('Edit existing → rename → Update applies the rename', () => {
  const doc = fakeDoc(withSet());
  render(<CompositionEditor document={doc} name="acme" />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  fireEvent.change(screen.getByDisplayValue('core'), {
    target: { value: 'base' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Update' }));
  expect(applied(doc).doc.resolutionOrder).toEqual([{ $ref: '#/sets/base' }]);
  expect(applied(doc).doc.sets.base).toBeTruthy();
});

test('Delete (existing, edit mode) → confirm → applies removal', () => {
  const doc = fakeDoc(withSet());
  render(<CompositionEditor document={doc} name="acme" />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  fireEvent.click(screen.getByRole('button', { name: 'Delete' })); // footer
  const deletes = screen.getAllByRole('button', { name: 'Delete' });
  fireEvent.click(deletes[deletes.length - 1] as HTMLElement); // the dialog's confirm
  expect(applied(doc).doc.resolutionOrder).toEqual([]);
});

test('Add modifier → two contexts → pick the 2nd as default → Save', () => {
  const doc = fakeDoc();
  render(<CompositionEditor document={doc} name="acme" />);
  fireEvent.click(screen.getByRole('button', { name: 'Add modifier' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add context' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add context' }));
  const radios = screen.getAllByRole('radio');
  expect(radios).toHaveLength(2); // first is the implicit default; pick the second explicitly
  fireEvent.click(radios[1] as HTMLElement);
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  const cmd = applied(doc);
  expect(cmd.doc.resolutionOrder).toEqual([{ $ref: '#/modifiers/modifier' }]);
  const mod = cmd.doc.modifiers.modifier;
  expect(Object.keys(mod?.contexts ?? {})).toEqual(['context', 'context2']);
  expect(mod?.default).toBe('context2');
});

test('reorder moves the editing item in the draft before Save', () => {
  const doc = fakeDoc({
    version: '2025.10',
    sets: { a: { sources: [] }, b: { sources: [] } },
    modifiers: {},
    resolutionOrder: [{ $ref: '#/sets/a' }, { $ref: '#/sets/b' }],
  });
  render(<CompositionEditor document={doc} name="acme" />);
  fireEvent.click(
    screen.getAllByRole('button', { name: 'Edit' })[0] as HTMLElement,
  ); // edit 'a'
  fireEvent.click(screen.getByRole('button', { name: 'Move down' }));
  fireEvent.click(screen.getByRole('button', { name: 'Update' }));
  expect(applied(doc).doc.resolutionOrder).toEqual([
    { $ref: '#/sets/b' },
    { $ref: '#/sets/a' },
  ]);
});

const ghostSource = (): ResolverDocument => ({
  version: '2025.10',
  sets: { base: { sources: [{ $ref: 'ghost.json' }] } },
  modifiers: {},
  resolutionOrder: [{ $ref: '#/sets/base' }],
});

test('unknown-source: a collapsed entry shows an error badge + border', () => {
  const doc = fakeDoc(ghostSource());
  const { container } = render(
    <CompositionEditor document={doc} name="acme" />,
  );
  expect(
    container.querySelector('[data-vtk-comp-badge="error"]'),
  ).not.toBeNull();
  expect(
    container.querySelector('vtk-concertina-item[data-vtk-invalid="error"]'),
  ).not.toBeNull();
});

test('unknown-source: editing marks the row and disables the primary; fixing re-enables', () => {
  const doc = fakeDoc(ghostSource());
  const { container } = render(
    <CompositionEditor document={doc} name="acme" />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  expect(
    container.querySelector('[data-vtk-comp-row][data-vtk-invalid]'),
  ).not.toBeNull();
  expect(
    (screen.getByRole('button', { name: 'Update' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.change(container.querySelector('select') as HTMLSelectElement, {
    target: { value: 'palette.json' },
  });
  expect(
    (screen.getByRole('button', { name: 'Update' }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
});

test('single-context: a warning shows above the footer but the primary stays enabled', () => {
  const doc = fakeDoc({
    version: '2025.10',
    sets: {},
    modifiers: { theme: { contexts: { light: [{ $ref: 'palette.json' }] } } },
    resolutionOrder: [{ $ref: '#/modifiers/theme' }],
  });
  const { container } = render(
    <CompositionEditor document={doc} name="acme" />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  expect(container.querySelector('[data-vtk-comp-warnings]')).not.toBeNull();
  expect(
    (screen.getByRole('button', { name: 'Update' }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
});

test('empty-contexts: editing a 0-context modifier disables the primary', () => {
  const doc = fakeDoc({
    version: '2025.10',
    sets: {},
    modifiers: { theme: { contexts: {} } },
    resolutionOrder: [{ $ref: '#/modifiers/theme' }],
  });
  render(<CompositionEditor document={doc} name="acme" />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  expect(
    (screen.getByRole('button', { name: 'Update' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});
