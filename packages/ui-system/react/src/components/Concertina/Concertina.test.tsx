// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import {
  Concertina,
  ConcertinaContent,
  ConcertinaHeader,
  ConcertinaItem,
  ConcertinaTrigger,
} from './index';

afterEach(cleanup);

function twoItems() {
  return render(
    <Concertina>
      <ConcertinaItem>
        <ConcertinaHeader>
          <ConcertinaTrigger>A</ConcertinaTrigger>
        </ConcertinaHeader>
        <ConcertinaContent>A body</ConcertinaContent>
      </ConcertinaItem>
      <ConcertinaItem open>
        <ConcertinaHeader>
          <ConcertinaTrigger>B</ConcertinaTrigger>
        </ConcertinaHeader>
        <ConcertinaContent>B body</ConcertinaContent>
      </ConcertinaItem>
    </Concertina>,
  );
}

const itemOf = (btn: HTMLElement) => btn.closest('vtk-concertina-item');

test('closed by default: aria-expanded false, item not marked open', () => {
  twoItems();
  const a = screen.getByRole('button', { name: 'A' });
  expect(a.getAttribute('aria-expanded')).toBe('false');
  expect(itemOf(a)?.hasAttribute('data-vtk-open')).toBe(false);
});

test('clicking the trigger toggles the open state', () => {
  twoItems();
  const a = screen.getByRole('button', { name: 'A' });
  fireEvent.click(a);
  expect(a.getAttribute('aria-expanded')).toBe('true');
  expect(itemOf(a)?.hasAttribute('data-vtk-open')).toBe(true);
  fireEvent.click(a);
  expect(a.getAttribute('aria-expanded')).toBe('false');
  expect(itemOf(a)?.hasAttribute('data-vtk-open')).toBe(false);
});

test('`open` marks the item open initially', () => {
  twoItems();
  const b = screen.getByRole('button', { name: 'B' });
  expect(b.getAttribute('aria-expanded')).toBe('true');
  expect(itemOf(b)?.hasAttribute('data-vtk-open')).toBe(true);
});

test('items open independently (multi-open)', () => {
  twoItems();
  const a = screen.getByRole('button', { name: 'A' });
  const b = screen.getByRole('button', { name: 'B' });
  fireEvent.click(a);
  expect(a.getAttribute('aria-expanded')).toBe('true');
  expect(b.getAttribute('aria-expanded')).toBe('true'); // B stayed open
});

test('content is always rendered (visibility is styling, not mounting)', () => {
  twoItems();
  expect(screen.getByText('A body')).toBeTruthy(); // A is closed, content still present
});

test('trigger aria-controls points at the content id', () => {
  twoItems();
  const a = screen.getByRole('button', { name: 'A' });
  const content = itemOf(a)?.querySelector('vtk-concertina-content');
  expect(content).not.toBeNull();
  expect(a.getAttribute('aria-controls')).toBe(content?.id);
});

test('Trigger outside an item throws', () => {
  expect(() => render(<ConcertinaTrigger>x</ConcertinaTrigger>)).toThrow(
    /ConcertinaItem/,
  );
});

test('controlled: with onToggle, open follows the prop and the trigger calls onToggle', () => {
  const onToggle = vi.fn();
  const item = (open: boolean) => (
    <Concertina>
      <ConcertinaItem open={open} onOpenChange={onToggle}>
        <ConcertinaHeader>
          <ConcertinaTrigger>C</ConcertinaTrigger>
        </ConcertinaHeader>
        <ConcertinaContent>C body</ConcertinaContent>
      </ConcertinaItem>
    </Concertina>
  );
  const { rerender } = render(item(false));
  const c = screen.getByRole('button', { name: 'C' });
  expect(c.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(c);
  expect(onToggle).toHaveBeenCalledWith(true); // parent decides; internal state does not flip
  expect(c.getAttribute('aria-expanded')).toBe('false');
  rerender(item(true));
  expect(
    screen.getByRole('button', { name: 'C' }).getAttribute('aria-expanded'),
  ).toBe('true');
});
