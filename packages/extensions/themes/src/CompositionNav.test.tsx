// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import { CompositionNav } from './CompositionNav';

// jsdom's <dialog> support is partial; make showModal/close drive the `open` property.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function showModal(
    this: HTMLDialogElement,
  ) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function close(
    this: HTMLDialogElement,
  ) {
    this.open = false;
  };
});
afterEach(cleanup);

const props = (over = {}) => ({
  names: ['acme', 'beta'],
  active: 'acme',
  onSelect: vi.fn(),
  onAdd: vi.fn(),
  onDelete: vi.fn(),
  ...over,
});

test('clicking a composition row calls onSelect', () => {
  const p = props();
  render(<CompositionNav {...p} />);
  fireEvent.click(screen.getByRole('button', { name: 'beta' }));
  expect(p.onSelect).toHaveBeenCalledWith('beta');
});

test('delete opens a confirm dialog; Delete calls onDelete, Cancel does not', () => {
  const p = props();
  render(<CompositionNav {...p} />);
  fireEvent.click(
    screen.getByRole('button', { name: 'Delete composition acme' }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(p.onDelete).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole('button', { name: 'Delete composition acme' }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(p.onDelete).toHaveBeenCalledWith('acme');
});

test('New composition: typing + Create calls onAdd; Create disabled for empty and duplicate', () => {
  const p = props();
  render(<CompositionNav {...p} />);
  fireEvent.click(screen.getByRole('button', { name: 'New composition' }));
  const create = () =>
    screen.getByRole('button', { name: 'Create' }) as HTMLButtonElement;
  const input = screen.getByLabelText('Composition name');
  expect(create().disabled).toBe(true); // empty
  fireEvent.change(input, { target: { value: 'acme' } });
  expect(create().disabled).toBe(true); // duplicate
  fireEvent.change(input, { target: { value: 'gamma' } });
  expect(create().disabled).toBe(false);
  fireEvent.click(create());
  expect(p.onAdd).toHaveBeenCalledWith('gamma');
});
