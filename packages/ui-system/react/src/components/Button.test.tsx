// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { Button } from './Button';

afterEach(cleanup);

test('variant maps to data-vtk-variant', () => {
  const { getByRole } = render(<Button variant="danger">x</Button>);
  expect(getByRole('button').getAttribute('data-vtk-variant')).toBe('danger');
});

test('no variant → no data-vtk-variant attribute', () => {
  const { getByRole } = render(<Button>x</Button>);
  expect(getByRole('button').hasAttribute('data-vtk-variant')).toBe(false);
});
