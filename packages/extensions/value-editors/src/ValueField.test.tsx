// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { ColorEditor } from './ColorEditor';
import { createValueEditorRegistry } from './registry';
import { ValueField } from './ValueField';
import type { ValueEditorService } from './value-editor';

afterEach(cleanup);

/** A ScopedConfig<{preferred}> with no per-type preference — the default resolution path. */
const config = { get: () => ({ preferred: {} }), subscribe: () => () => {} };

/**
 * Registry seeded the way `api.ts` seeds it: a LOADER, not a component (ADR-0029). The point of
 * these tests is the seam between that loader and `React.lazy` — nothing else exercises it.
 */
function registryWithColorEditor(): ValueEditorService {
  const registry = createValueEditorRegistry(config);
  registry.register({
    id: 'vtk.color',
    types: ['color'],
    load: async () => ({ default: ColorEditor }),
  });
  return registry;
}

test('renders the lazily-loaded editor for the token type', async () => {
  render(
    <ValueField
      value="#ff0000"
      type="color"
      onChange={() => {}}
      valueEditors={registryWithColorEditor()}
    />,
  );

  // Suspended on first paint: the editor module has not resolved yet.
  expect(screen.queryByLabelText('Hex value')).toBeNull();

  const hex = await screen.findByLabelText('Hex value');
  expect((hex as HTMLInputElement).value).toBe('#ff0000');
  expect(screen.getByLabelText('Color')).toBeTruthy();
});

test('the loaded editor commits through onChange', async () => {
  const onChange = vi.fn();
  render(
    <ValueField
      value="#ff0000"
      type="color"
      onChange={onChange}
      valueEditors={registryWithColorEditor()}
    />,
  );

  const hex = await screen.findByLabelText('Hex value');
  fireEvent.change(hex, { target: { value: '#00ff00' } });
  expect(onChange).toHaveBeenCalledWith('#00ff00');
});

test('falls back to the text field for a type with no registered editor', async () => {
  render(
    <ValueField
      value="8px"
      type="dimension"
      onChange={() => {}}
      valueEditors={registryWithColorEditor()}
    />,
  );

  const field = screen.getByLabelText('Value') as HTMLInputElement;
  expect(field.value).toBe('8px');
  expect(screen.queryByLabelText('Hex value')).toBeNull();
});
