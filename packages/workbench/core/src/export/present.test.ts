import { expect, test } from 'vitest';
import type { Token } from '../document/types';
import type {
  CommandExtension,
  InterchangePresentationContext,
} from '../shell/types';
import { createTypeLoweringRegistry, lowerTokens } from './lowering';
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
  const out = await presentInterchange(input, [spacial], [present], 'terrazzo');

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
  expect(await presentInterchange(input, [spacial], [], 'terrazzo')).toBe(
    input,
  );
  const declined = await presentInterchange(
    input,
    [spacial],
    [{ handle: () => undefined }],
    'terrazzo',
  );
  expect(declined['core.json']).toBe(input['core.json']);
});

/** The type's owner lowers it once: four standard `dimension`s, CSS shorthand order. */
const lowerings = createTypeLoweringRegistry();
lowerings.register({
  type: 'spacial',
  lower(token) {
    const [top, right = top, bottom = top, left = right] =
      token.value as unknown[];
    return {
      top: { type: 'dimension', value: top },
      right: { type: 'dimension', value: right },
      bottom: { type: 'dimension', value: bottom },
      left: { type: 'dimension', value: left },
    };
  },
});

/** A presentation for ONE exporter: the shorthand for terrazzo, nothing for anyone else. */
const forTerrazzo: CommandExtension = {
  handle(context) {
    const { exporter } = context as InterchangePresentationContext;
    return exporter === 'terrazzo' ? present.handle(context) : undefined;
  },
};

test('a presentation answers for its exporter; every other exporter gets the lowering', async () => {
  const input = files();
  const css = await presentInterchange(
    input,
    [spacial],
    [forTerrazzo],
    'terrazzo',
    lowerings,
  );
  expect(
    (css['core.json'] as Record<string, Record<string, unknown>>).space?.inset,
  ).toEqual({ $type: 'string', $value: '0px 8px' });

  const other = await presentInterchange(
    input,
    [spacial],
    [forTerrazzo],
    'figma',
    lowerings,
  );
  expect(
    (other['core.json'] as Record<string, Record<string, unknown>>).space
      ?.inset,
  ).toEqual({
    top: { $type: 'dimension', $value: { value: 0, unit: 'px' } },
    right: { $type: 'dimension', $value: { value: 8, unit: 'px' } },
    bottom: { $type: 'dimension', $value: { value: 0, unit: 'px' } },
    left: { $type: 'dimension', $value: { value: 8, unit: 'px' } },
  });
});

test('resolved bundles lower the same way — references stay references', () => {
  const [top, , , left] = lowerTokens(
    [{ ...spacial, value: ['{space.gap}', { value: 8, unit: 'px' }] }],
    lowerings,
  );
  expect(top).toMatchObject({
    path: ['space', 'inset', 'top'],
    type: 'dimension',
    value: '{space.gap}',
    set: 'core',
  });
  expect(left?.value).toEqual({ value: 8, unit: 'px' });
  // A type with no lowering passes through as authored.
  const gap: Token = { ...spacial, type: 'dimension', path: ['space', 'gap'] };
  expect(lowerTokens([gap], lowerings)).toEqual([gap]);
});

test("a group's own value lowers INTO the group — `$root` is never a parent", async () => {
  const root: Token = {
    ...spacial,
    id: 'core/space.squish.$root',
    path: ['space', 'squish', '$root'],
  };
  // Resolved bundles: children beside the group's other children, a real child winning.
  const top: Token = {
    ...spacial,
    id: 'core/space.squish.top',
    path: ['space', 'squish', 'top'],
    type: 'dimension',
    value: { value: 99, unit: 'px' },
  };
  const lowered = lowerTokens([root, top], lowerings);
  expect(lowered.map((t) => t.path.join('.'))).toEqual([
    'space.squish.right',
    'space.squish.bottom',
    'space.squish.left',
    'space.squish.top',
  ]);
  expect(lowered.find((t) => t.path.at(-1) === 'top')?.value).toEqual({
    value: 99,
    unit: 'px',
  });

  // Staged files: the `$root` node goes, its children join the group.
  const input = {
    'core.json': {
      space: {
        squish: {
          $root: {
            $type: 'spacial',
            $value: [
              { value: 0, unit: 'px' },
              { value: 8, unit: 'px' },
            ],
          },
        },
      },
    },
  };
  const staged = await presentInterchange(
    input,
    [root],
    [],
    'figma',
    lowerings,
  );
  const squish = (
    (staged['core.json'] as Record<string, Record<string, unknown>>)
      .space as Record<string, Record<string, unknown>>
  ).squish;
  expect(Object.keys(squish ?? {}).sort()).toEqual([
    'bottom',
    'left',
    'right',
    'top',
  ]);
});
