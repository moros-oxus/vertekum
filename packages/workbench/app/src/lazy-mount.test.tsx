// @vitest-environment jsdom
import { expect, test } from 'vitest';
import { lazyMount } from './lazy-mount';

/** Let the loader promise settle and React commit; polls so we don't guess at tick counts. */
async function settle(element: HTMLElement): Promise<void> {
  for (let i = 0; i < 20 && element.textContent === ''; i++) {
    await new Promise((r) => setTimeout(r, 5));
  }
}

const flush = () => new Promise((r) => setTimeout(r, 20));

test('lazyMount renders the view once its module resolves', async () => {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const mount = lazyMount(
    async () => ({ default: (label: string) => <p>{label}</p> }),
    'hello',
  );
  const cleanup = mount(element, {} as never);
  expect(element.textContent).toBe('');
  await settle(element);
  expect(element.textContent).toBe('hello');
  cleanup?.();
});

test('lazyMount does not render when cleaned up before the module resolves', async () => {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const mount = lazyMount(
    async () => ({ default: (label: string) => <p>{label}</p> }),
    'hello',
  );
  const cleanup = mount(element, {} as never);
  cleanup?.();
  await flush();
  expect(element.textContent).toBe('');
});
