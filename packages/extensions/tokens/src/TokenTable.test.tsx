// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Token } from 'vertekum';
import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import { TokenTable } from './TokenTable';

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

const token: Token = {
  id: 'id-a',
  path: ['color', 'a'],
  type: 'color',
  value: '#f00',
  set: 'core',
};
const props = (over = {}) => ({
  tokens: [token],
  density: 'comfortable' as const,
  showIds: false,
  byPath: new Map<string, Token>(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  ...over,
});

test('Edit calls onEdit with the row token', () => {
  const p = props();
  render(<TokenTable {...p} />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
  expect(p.onEdit).toHaveBeenCalledWith(token);
});

test('Delete opens a confirm dialog; Delete calls onDelete, Cancel does not', () => {
  const p = props();
  render(<TokenTable {...p} />);
  fireEvent.click(screen.getByRole('button', { name: 'Delete color.a' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(p.onDelete).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Delete color.a' }));
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(p.onDelete).toHaveBeenCalledWith('id-a');
});
