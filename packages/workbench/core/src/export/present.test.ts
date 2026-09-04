import { expect, test } from 'vitest';
import type { Token } from '../document/types';
import type {
  CommandExtension,
  InterchangePresentationContext,
} from '../shell/types';
import { presentInterchange } from './present';

const spacial: Token = {
  id: 'core/space.inset',
  path: ['space', 'inset'],
  type: 'spacial',
  value: [
    { value: 0, unit: 'px' },
    { value: 8, unit: 'px' },
  ],
  set: 'core',
};

const files = () => ({
  'core.json': {
    space: {
      inset: {
        $type: 'spacial',
        $value: [
          { value: 0, unit: 'px' },
          { value: 8, unit: 'px' },
        ],
      },
      gap: { $type: 'dimension', $value: { value: 4, unit: 'px' } },
    },
  },
});

/** The consumer-driver presentation: a spacial array becomes a string shorthand. */
const present: CommandExtension = {
  handle(context) {
    const { token } = context as InterchangePresentationContext;
    if (token.type !== 'spacial') return undefined;
    const entries = (token.value as Array<{ value: number; unit: string }>).map(
      (e) => `${e.value}${e.unit}`,
    );
    return { $type: 'string', $value: entries.join(' ') };
  },
};

test('a build-chain handler replaces the node exporters see, nothing else', async () => {
  const input = files();
  const out = await presentInterchange(input, [spacial], [present]);

  const tree = out['core.json'] as Record<string, Record<string, unknown>>;
  expect(tree.space?.inset).toEqual({ $type: 'string', $value: '0px 8px' });
  // Untouched siblings survive; the input trees are never mutated.
  expect(tree.space?.gap).toEqual({
    $type: 'dimension',
    $value: { value: 4, unit: 'px' },
  });
  expect(
    (input['core.json'] as Record<string, Record<string, unknown>>).space
      ?.inset,
  ).toHaveProperty('$type', 'spacial');
});

test('with no chain the staging is the identity, by reference', async () => {
  const input = files();
  expect(await presentInterchange(input, [spacial], [])).toBe(input);
  const declined = await presentInterchange(
    input,
    [spacial],
    [{ handle: () => undefined }],
  );
  expect(declined['core.json']).toBe(input['core.json']);
});
