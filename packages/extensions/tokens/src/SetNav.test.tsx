// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import { SetNav } from './SetNav';

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
  sets: ['core', 'brand'],
  activeSet: 'core',
  onSelect: vi.fn(),
  onAdd: vi.fn(),
  onDelete: vi.fn(),
  ...over,
});

test('clicking a set row calls onSelect', () => {
  const p = props();
  render(<SetNav {...p} />);
  fireEvent.click(screen.getByRole('button', { name: 'brand' }));
  expect(p.onSelect).toHaveBeenCalledWith('brand');
});

test('delete opens a confirm dialog; Delete calls onDelete, Cancel does not', () => {
  const p = props();
  render(<SetNav {...p} />);
  fireEvent.click(screen.getByRole('button', { name: 'Delete set core' }));
  expect(screen.getByText(/tokens will be removed/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(p.onDelete).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Delete set core' }));
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(p.onDelete).toHaveBeenCalledWith('core');
});

test('New set: typing + Create calls onAdd; Create disabled for empty and duplicate', () => {
  const p = props();
  render(<SetNav {...p} />);
  fireEvent.click(screen.getByRole('button', { name: 'New set' }));
  const create = () =>
    screen.getByRole('button', { name: 'Create' }) as HTMLButtonElement;
  const input = screen.getByLabelText('Set name');
  expect(create().disabled).toBe(true); // empty
  fireEvent.change(input, { target: { value: 'core' } });
  expect(create().disabled).toBe(true); // duplicate
  fireEvent.change(input, { target: { value: 'space' } });
  expect(create().disabled).toBe(false);
  fireEvent.click(create());
  expect(p.onAdd).toHaveBeenCalledWith('space');
});
