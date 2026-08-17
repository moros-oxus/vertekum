import { describe, expect, test } from 'vitest';
import type { DtcgNode } from '../dtcg/parse';
import { serializeDocument } from '../storage/provider';
import {
  addResolver,
  addSet,
  addToken,
  moveTokens,
  removeResolver,
  removeSet,
  removeToken,
  renamePath,
  replaceToken,
  updateResolver,
  updateTokenValue,
} from './commands';
import { createDocument } from './document';
import { emptyResolver, type ResolverDocument } from './resolver-types';

function docWithToken() {
  const doc = createDocument();
  doc.apply(
    addToken({
      id: 'tokens:color.primary',
      path: ['color', 'primary'],
      type: 'color',
      value: '#f00',
    }),
  );
  return doc;
}

describe('document store', () => {
  test('addToken adds a token retrievable by id', () => {
    const doc = createDocument();

    doc.apply(
      addToken({
        id: 'tokens:color.primary',
        path: ['color', 'primary'],
        type: 'color',
        value: '#f00',
      }),
    );

    expect(doc.getToken('tokens:color.primary')).toEqual({
      id: 'tokens:color.primary',
      set: 'tokens',
      path: ['color', 'primary'],
      type: 'color',
      value: '#f00',
    });
  });

  test('updateTokenValue changes an existing token value, preserving other fields', () => {
    const doc = docWithToken();

    doc.apply(updateTokenValue('tokens:color.primary', '#0f0'));

    expect(doc.getToken('tokens:color.primary')).toEqual({
      id: 'tokens:color.primary',
      set: 'tokens',
      path: ['color', 'primary'],
      type: 'color',
      value: '#0f0',
    });
  });
});

describe('undo/redo', () => {
  test('undo reverts an updateTokenValue', () => {
    const doc = docWithToken();
    doc.apply(updateTokenValue('tokens:color.primary', '#0f0'));

    doc.undo();

    expect(doc.getToken('tokens:color.primary')?.value).toBe('#f00');
  });

  test('undo of addToken removes the token', () => {
    const doc = docWithToken();

    doc.undo();

    expect(doc.getToken('tokens:color.primary')).toBeUndefined();
  });

  test('redo re-applies an undone command', () => {
    const doc = docWithToken();
    doc.apply(updateTokenValue('tokens:color.primary', '#0f0'));
    doc.undo();

    doc.redo();

    expect(doc.getToken('tokens:color.primary')?.value).toBe('#0f0');
  });

  test('a new command clears the redo stack', () => {
    const doc = docWithToken();
    doc.apply(updateTokenValue('tokens:color.primary', '#0f0'));
    doc.undo();

    doc.apply(updateTokenValue('tokens:color.primary', '#00f'));
    doc.redo(); // nothing to redo — should be a no-op

    expect(doc.getToken('tokens:color.primary')?.value).toBe('#00f');
  });

  test('undo with empty history is a no-op', () => {
    const doc = createDocument();
    expect(() => doc.undo()).not.toThrow();
  });
});

describe('listing and change notification', () => {
  test('getAllTokens returns every token', () => {
    const doc = createDocument();
    doc.apply(
      addToken({
        id: 'tokens:color.a',
        path: ['color', 'a'],
        type: 'color',
        value: '#f00',
      }),
    );
    doc.apply(
      addToken({
        id: 'tokens:color.b',
        path: ['color', 'b'],
        type: 'color',
        value: '#0f0',
      }),
    );

    expect(
      doc
        .getAllTokens()
        .map((t) => t.id)
        .sort(),
    ).toEqual(['tokens:color.a', 'tokens:color.b']);
  });

  test('subscribers are notified on apply, undo, and redo', () => {
    const doc = docWithToken();
    let count = 0;
    doc.subscribe(() => {
      count++;
    });

    doc.apply(updateTokenValue('tokens:color.primary', '#0f0'));
    doc.undo();
    doc.redo();

    expect(count).toBe(3);
  });

  test('unsubscribe stops notifications', () => {
    const doc = docWithToken();
    let count = 0;
    const unsubscribe = doc.subscribe(() => {
      count++;
    });

    unsubscribe();
    doc.apply(updateTokenValue('tokens:color.primary', '#0f0'));

    expect(count).toBe(0);
  });
});

describe('hydrate', () => {
  test('replaces all tokens and clears undo history', () => {
    const doc = docWithToken();

    doc.hydrate(
      serializeDocument(
        [{ id: 'tokens:a', path: ['a'], type: 'color', value: '#000' }],
        [],
      ),
    );
    doc.undo(); // hydration is not undoable

    expect(doc.getAllTokens().map((t) => t.id)).toEqual(['tokens:a']);
  });

  test('notifies subscribers once', () => {
    const doc = createDocument();
    let count = 0;
    doc.subscribe(() => count++);

    doc.hydrate(
      serializeDocument(
        [{ id: 'tokens:a', path: ['a'], type: 'color', value: '#000' }],
        [],
      ),
    );

    expect(count).toBe(1);
  });
});

describe('coalescing', () => {
  test('consecutive edits to the same token value collapse into one undo step', () => {
    const doc = docWithToken();
    doc.apply(updateTokenValue('tokens:color.primary', '#f11'));
    doc.apply(updateTokenValue('tokens:color.primary', '#f22'));
    doc.apply(updateTokenValue('tokens:color.primary', '#f33'));

    doc.undo();

    expect(doc.getToken('tokens:color.primary')?.value).toBe('#f00');
  });

  test('redo re-applies the coalesced latest value', () => {
    const doc = docWithToken();
    doc.apply(updateTokenValue('tokens:color.primary', '#f11'));
    doc.apply(updateTokenValue('tokens:color.primary', '#f22'));
    doc.undo();

    doc.redo();

    expect(doc.getToken('tokens:color.primary')?.value).toBe('#f22');
  });

  test('edits to different tokens do not coalesce', () => {
    const doc = createDocument();
    doc.apply(
      addToken({
        id: 'tokens:c.a',
        path: ['c', 'a'],
        type: 'color',
        value: '#000',
      }),
    );
    doc.apply(
      addToken({
        id: 'tokens:c.b',
        path: ['c', 'b'],
        type: 'color',
        value: '#000',
      }),
    );
    doc.apply(updateTokenValue('tokens:c.a', '#111'));
    doc.apply(updateTokenValue('tokens:c.b', '#222'));

    doc.undo();

    expect(doc.getToken('tokens:c.b')?.value).toBe('#000');
    expect(doc.getToken('tokens:c.a')?.value).toBe('#111');
  });

  test('addToken never coalesces with a following add', () => {
    const doc = createDocument();
    doc.apply(
      addToken({
        id: 'tokens:c.a',
        path: ['c', 'a'],
        type: 'color',
        value: '#000',
      }),
    );
    doc.apply(
      addToken({
        id: 'tokens:c.b',
        path: ['c', 'b'],
        type: 'color',
        value: '#000',
      }),
    );

    doc.undo();

    expect(doc.getToken('tokens:c.b')).toBeUndefined();
    expect(doc.getToken('tokens:c.a')).toBeDefined();
  });

  test('undo seals the run: a later same-target edit starts a new entry', () => {
    const doc = docWithToken();
    doc.apply(updateTokenValue('tokens:color.primary', '#f11'));
    doc.undo();
    doc.apply(updateTokenValue('tokens:color.primary', '#f22'));

    doc.undo();

    expect(doc.getToken('tokens:color.primary')?.value).toBe('#f00');
  });

  test('commitEdit() forces a boundary between same-target edits', () => {
    const doc = docWithToken();
    doc.apply(updateTokenValue('tokens:color.primary', '#f11'));
    doc.commitEdit();
    doc.apply(updateTokenValue('tokens:color.primary', '#f22'));

    doc.undo();
    expect(doc.getToken('tokens:color.primary')?.value).toBe('#f11');

    doc.undo();
    expect(doc.getToken('tokens:color.primary')?.value).toBe('#f00');
  });

  test('version increments on every apply, including coalesced keystrokes', () => {
    const doc = docWithToken();
    const v = doc.getVersion();

    doc.apply(updateTokenValue('tokens:color.primary', '#f11'));
    doc.apply(updateTokenValue('tokens:color.primary', '#f22'));

    expect(doc.getVersion()).toBe(v + 2);
  });
});

describe('replaceToken', () => {
  test('replaces value, description, and vtk in one command, preserving id', () => {
    const doc = docWithToken();

    doc.apply(
      replaceToken('tokens:color.primary', {
        id: 't1',
        path: ['color', 'primary'],
        type: 'color',
        value: '#0f0',
        description: 'brand accent',
        // `meta` is the active vtk sub-key. `themes` was retired, and the parser ignores it — it
        // still round-trips to disk untouched, it is simply not surfaced on the model.
        vtk: { meta: { owner: 'brand' } },
      }),
    );

    expect(doc.getToken('tokens:color.primary')).toEqual({
      id: 'tokens:color.primary',
      set: 'tokens',
      path: ['color', 'primary'],
      type: 'color',
      value: '#0f0',
      description: 'brand accent',
      vtk: { meta: { owner: 'brand' } },
    });
  });

  test("a token's id always names its location, whatever the caller passed", () => {
    const doc = docWithToken();

    doc.apply(
      replaceToken('tokens:color.primary', {
        id: 'nonsense',
        path: ['color', 'primary'],
        type: 'color',
        value: '#0f0',
      }),
    );

    // Identity is derived, so a caller cannot assert one — 'nonsense' is simply ignored.
    expect(doc.getToken('nonsense')).toBeUndefined();
    expect(doc.getToken('tokens:color.primary')?.value).toBe('#0f0');
  });

  test('one undo restores the entire prior token', () => {
    const doc = docWithToken();
    // Seed a vtk bucket so the restore covers preserved extension data.
    doc.apply(
      replaceToken('tokens:color.primary', {
        id: 't1',
        path: ['color', 'primary'],
        type: 'color',
        value: '#f00',
        vtk: { themes: { dark: { $value: '#000' } } },
      }),
    );
    doc.commitEdit();
    const before = doc.getToken('tokens:color.primary');

    doc.apply(
      replaceToken('tokens:color.primary', {
        id: 'tokens:color.renamed',
        path: ['color', 'renamed'],
        type: 'dimension',
        value: '4px',
      }),
    );
    doc.undo();

    expect(doc.getToken('tokens:color.primary')).toEqual(before);
  });

  test('redo re-applies the replacement', () => {
    const doc = docWithToken();
    doc.apply(
      replaceToken('tokens:color.primary', {
        id: 'tokens:color.primary',
        path: ['color', 'primary'],
        type: 'color',
        value: '#0f0',
      }),
    );
    doc.undo();

    doc.redo();

    expect(doc.getToken('tokens:color.primary')?.value).toBe('#0f0');
  });

  test('does not coalesce with a following replace (each is one undo step)', () => {
    const doc = docWithToken();
    const base = {
      id: 'tokens:color.primary',
      path: ['color', 'primary'],
      type: 'color',
    };
    doc.apply(replaceToken('tokens:color.primary', { ...base, value: '#111' }));
    doc.apply(replaceToken('tokens:color.primary', { ...base, value: '#222' }));

    doc.undo();
    expect(doc.getToken('tokens:color.primary')?.value).toBe('#111');
    doc.undo();
    expect(doc.getToken('tokens:color.primary')?.value).toBe('#f00');
  });
});

describe('version', () => {
  test('increments on each mutation, so callers can detect unsaved changes', () => {
    const doc = docWithToken();
    const v = doc.getVersion();

    doc.apply(updateTokenValue('tokens:color.primary', '#0f0'));

    expect(doc.getVersion()).toBe(v + 1);
  });

  test('does not increment on a no-op undo', () => {
    const doc = createDocument();
    const v = doc.getVersion();

    doc.undo();

    expect(doc.getVersion()).toBe(v);
  });
});

describe('getAllTokens reference stability', () => {
  test('returns the same array reference until a mutation, then a new one', () => {
    const doc = docWithToken();
    const before = doc.getAllTokens();

    expect(doc.getAllTokens()).toBe(before);

    doc.apply(updateTokenValue('tokens:color.primary', '#0f0'));

    expect(doc.getAllTokens()).not.toBe(before);
  });
});

describe('token sets', () => {
  const tok = (name: string, set: string) => ({
    id: `${set}:${name}`,
    path: [name],
    type: 'color',
    value: '#000',
    set,
  });

  test('addSet adds a set; undo removes it', () => {
    const doc = createDocument();
    doc.hydrate(serializeDocument([], []));
    doc.apply(addSet('brand'));
    expect(doc.getSets()).toEqual(['brand']);
    doc.undo();
    expect(doc.getSets()).toEqual([]);
  });

  test('removeSet drops the set and its tokens; undo restores both', () => {
    const doc = createDocument();
    doc.hydrate(
      serializeDocument(
        [tok('a', 'core'), tok('b', 'brand')],
        ['core', 'brand'],
      ),
    );
    doc.apply(removeSet('core'));
    expect(doc.getSets()).toEqual(['brand']);
    expect(doc.getAllTokens().map((t) => t.id)).toEqual(['brand:b']);
    doc.undo();
    expect(doc.getSets().sort()).toEqual(['brand', 'core']);
    expect(
      doc
        .getAllTokens()
        .map((t) => t.id)
        .sort(),
    ).toEqual(['brand:b', 'core:a']);
  });

  test('moveTokens reassigns sets in one step; undo restores prior sets', () => {
    const doc = createDocument();
    doc.hydrate(
      serializeDocument(
        [tok('a', 'core'), tok('b', 'brand')],
        ['core', 'brand'],
      ),
    );
    doc.apply(moveTokens(['core:a', 'brand:b'], 'core'));
    expect(doc.getAllTokens().map((t) => t.set)).toEqual(['core', 'core']);
    doc.undo();
    expect(doc.getAllTokens().map((t) => t.set)).toEqual(['core', 'brand']);
  });

  test('hydrate seeds sets and clears history', () => {
    const doc = createDocument();
    doc.hydrate(serializeDocument([tok('a', 'core')], ['core', 'empty']));
    expect(doc.getSets()).toEqual(['core', 'empty']);
    doc.undo(); // nothing to undo
    expect(doc.getSets()).toEqual(['core', 'empty']);
  });
});

describe('resolvers', () => {
  const docFor = (name: string): ResolverDocument => ({
    ...emptyResolver(),
    name,
  });

  test('addResolver adds it; undo removes it', () => {
    const doc = createDocument();
    doc.hydrate(serializeDocument([], []));
    doc.apply(addResolver('acme'));
    expect([...doc.getResolvers().keys()]).toEqual(['acme']);
    expect(doc.getResolvers().get('acme')).toEqual(emptyResolver());
    doc.undo();
    expect([...doc.getResolvers().keys()]).toEqual([]);
  });

  test('removeResolver drops it; undo restores the exact document', () => {
    const doc = createDocument();
    doc.hydrate(serializeDocument([], [], new Map([['acme', docFor('acme')]])));
    doc.apply(removeResolver('acme'));
    expect(doc.getResolvers().size).toBe(0);
    doc.undo();
    expect(doc.getResolvers().get('acme')).toEqual(docFor('acme'));
  });

  test('updateResolver replaces; undo restores the previous document', () => {
    const doc = createDocument();
    doc.hydrate(
      serializeDocument([], [], new Map([['acme', emptyResolver()]])),
    );
    doc.apply(updateResolver('acme', docFor('acme')));
    expect(doc.getResolvers().get('acme')?.name).toBe('acme');
    doc.undo();
    expect(doc.getResolvers().get('acme')).toEqual(emptyResolver());
  });

  test('successive updates to one resolver coalesce into a single undo', () => {
    const doc = createDocument();
    doc.hydrate(
      serializeDocument([], [], new Map([['acme', emptyResolver()]])),
    );
    doc.apply(updateResolver('acme', docFor('one')));
    doc.apply(updateResolver('acme', docFor('two')));
    expect(doc.getResolvers().get('acme')?.name).toBe('two');
    doc.undo();
    expect(doc.getResolvers().get('acme')).toEqual(emptyResolver()); // one undo, back to start
  });

  test('updates to different resolvers do not coalesce', () => {
    const doc = createDocument();
    doc.hydrate(
      serializeDocument(
        [],
        [],
        new Map([
          ['a', emptyResolver()],
          ['b', emptyResolver()],
        ]),
      ),
    );
    doc.apply(updateResolver('a', docFor('a2')));
    doc.apply(updateResolver('b', docFor('b2')));
    doc.undo();
    expect(doc.getResolvers().get('b')).toEqual(emptyResolver());
    expect(doc.getResolvers().get('a')?.name).toBe('a2'); // still applied
  });

  test('getResolvers returns a stable ref between mutations', () => {
    const doc = createDocument();
    doc.hydrate(serializeDocument([], []));
    const first = doc.getResolvers();
    expect(doc.getResolvers()).toBe(first);
    doc.apply(addResolver('acme'));
    expect(doc.getResolvers()).not.toBe(first);
  });

  test('hydrate seeds resolvers and clears history', () => {
    const doc = createDocument();
    doc.hydrate(serializeDocument([], [], new Map([['acme', docFor('acme')]])));
    expect([...doc.getResolvers().keys()]).toEqual(['acme']);
    doc.undo(); // nothing to undo — history cleared
    expect([...doc.getResolvers().keys()]).toEqual(['acme']);
  });
});

/** A core ramp plus a light alias into it — the shape a rename has to keep consistent. */
function rampDoc() {
  const doc = createDocument();
  doc.hydrate(
    serializeDocument(
      [
        {
          id: 'core:color.red.100',
          path: ['color', 'red', '100'],
          type: 'color',
          value: '#fee2e2',
          set: 'core',
        },
        {
          id: 'core:color.red.900',
          path: ['color', 'red', '900'],
          type: 'color',
          value: '#7f1d1d',
          set: 'core',
        },
        {
          id: 'l1',
          path: ['color', 'brand', 'primary'],
          type: 'color',
          value: '{color.red.900}',
          set: 'light',
        },
      ],
      ['core', 'light'],
    ),
  );
  return doc;
}

/**
 * Keyed by PATH, not id. Identity is `(set, path)`, so a rename changes a token's id — asking
 * "where did c2 end up" is a question only a stable id could answer. What these tests actually
 * care about is which paths exist and what the aliases now point at.
 */
const byPath = (doc: ReturnType<typeof createDocument>) =>
  new Map(doc.getAllTokens().map((t) => [t.path.join('.'), t]));

const paths = (doc: ReturnType<typeof createDocument>) =>
  doc.getAllTokens().map((t) => t.path.join('.'));

test('renaming through replaceToken rewrites the aliases that targeted it', () => {
  const doc = rampDoc();
  doc.apply(
    replaceToken('core:color.red.900', {
      id: 'core:color.red.950',
      path: ['color', 'red', '950'],
      type: 'color',
      value: '#7f1d1d',
      set: 'core',
    }),
  );

  const tokens = byPath(doc);
  expect(paths(doc)).toContain('color.red.950');
  expect(tokens.get('color.brand.primary')?.value).toBe('{color.red.950}');
});

test('one undo reverts a rename and every alias it rewrote', () => {
  const doc = rampDoc();
  doc.apply(
    replaceToken('core:color.red.900', {
      id: 'core:color.red.950',
      path: ['color', 'red', '950'],
      type: 'color',
      value: '#7f1d1d',
      set: 'core',
    }),
  );
  doc.undo();

  const tokens = byPath(doc);
  expect(paths(doc)).toContain('color.red.900');
  expect(tokens.get('color.brand.primary')?.value).toBe('{color.red.900}');
});

test('a replaceToken whose rename would collide is refused entirely', () => {
  const doc = rampDoc();
  doc.apply(
    replaceToken('core:color.red.900', {
      id: 'core:color.red.100',
      path: ['color', 'red', '100'],
      type: 'color',
      value: '#000000',
      set: 'core',
    }),
  );

  const tokens = byPath(doc);
  // Neither the path nor the value landed: a partial apply would have created two tokens at
  // `color.red.100`.
  expect(paths(doc)).toContain('color.red.900');
  expect(tokens.get('color.red.900')?.value).toBe('#7f1d1d');
});

test('replaceToken without a path change leaves other tokens untouched', () => {
  const doc = rampDoc();
  doc.apply(
    replaceToken('core:color.red.900', {
      id: 'core:color.red.900',
      path: ['color', 'red', '900'],
      type: 'color',
      value: '#000000',
      set: 'core',
    }),
  );

  const tokens = byPath(doc);
  expect(tokens.get('color.red.900')?.value).toBe('#000000');
  expect(tokens.get('color.brand.primary')?.value).toBe('{color.red.900}');
});

test('a group rename is refused without allowGroup', () => {
  const doc = rampDoc();
  doc.apply(renamePath(['color', 'red'], ['color', 'danger']));
  const paths = doc.getAllTokens().map((t) => t.path.join('.'));
  expect(paths).toContain('color.red.900');
  expect(paths).not.toContain('color.danger.900');
});

test('a group rename applies with allowGroup and rewrites aliases', () => {
  const doc = rampDoc();
  doc.apply(
    renamePath(['color', 'red'], ['color', 'danger'], { allowGroup: true }),
  );
  const tokens = byPath(doc);
  expect(paths(doc)).toContain('color.danger.100');
  expect(paths(doc)).toContain('color.danger.900');
  expect(tokens.get('color.brand.primary')?.value).toBe('{color.danger.900}');
});

test('one undo reverts a whole group rename', () => {
  const doc = rampDoc();
  doc.apply(
    renamePath(['color', 'red'], ['color', 'danger'], { allowGroup: true }),
  );
  doc.undo();
  const tokens = byPath(doc);
  expect(paths(doc)).toContain('color.red.100');
  expect(paths(doc)).toContain('color.red.900');
  expect(tokens.get('color.brand.primary')?.value).toBe('{color.red.900}');
});

test('redo reproduces the rename', () => {
  const doc = rampDoc();
  doc.apply(
    renamePath(['color', 'red'], ['color', 'danger'], { allowGroup: true }),
  );
  doc.undo();
  doc.redo();
  const tokens = byPath(doc);
  expect(paths(doc)).toContain('color.danger.900');
  expect(tokens.get('color.brand.primary')?.value).toBe('{color.danger.900}');
});

test('a leaf rename through renamePath needs no allowGroup', () => {
  const doc = rampDoc();
  doc.apply(renamePath(['color', 'red', '900'], ['color', 'red', '950']));
  const tokens = byPath(doc);
  expect(paths(doc)).toContain('color.red.950');
  expect(tokens.get('color.brand.primary')?.value).toBe('{color.red.950}');
});

test('a colliding rename is a no-op', () => {
  const doc = rampDoc();
  doc.apply(renamePath(['color', 'red', '900'], ['color', 'red', '100']));
  expect(paths(doc)).toContain('color.red.900');
  expect(paths(doc)).toContain('color.red.100');
});

describe('group renames and emptied groups', () => {
  const withGroups = () => {
    const doc = createDocument();
    doc.hydrate({
      'core.json': {
        space: {
          $type: 'dimension',
          $description: 'Scale',
          '1': { $value: '4px' },
        },
        color: {
          $type: 'color',
          red: {
            '100': { $value: '#fee' },
            '900': { $value: '{color.red.100}' },
          },
        },
      },
    });
    return doc;
  };

  test('a group rename carries the group’s own $type and $description', () => {
    const doc = withGroups();
    doc.apply(renamePath(['space'], ['spacing'], { allowGroup: true }));

    const core = doc.getFiles()['core.json'] as Record<string, DtcgNode>;
    expect(core.spacing).toMatchObject({
      $type: 'dimension',
      $description: 'Scale',
    });
    expect(core.space).toBeUndefined();
    // Moving tokens one at a time stranded the group's $type and silently untyped everything.
    expect(
      doc.getAllTokens().find((t) => t.path.join('.') === 'spacing.1')?.type,
    ).toBe('dimension');
  });

  test('an alias INSIDE the renamed group is rewritten, not left dangling', () => {
    const doc = withGroups();
    doc.apply(
      renamePath(['color', 'red'], ['color', 'danger'], { allowGroup: true }),
    );

    expect(
      doc.getAllTokens().find((t) => t.path.join('.') === 'color.danger.900')
        ?.value,
    ).toBe('{color.danger.100}');
  });

  test('a rename leaves no empty group behind', () => {
    const doc = withGroups();
    doc.apply(
      renamePath(['color', 'red'], ['color', 'danger'], { allowGroup: true }),
    );

    const color = (doc.getFiles()['core.json'] as Record<string, DtcgNode>)
      .color as DtcgNode;
    expect(color.red).toBeUndefined();
    expect(color.$type).toBe('color'); // the surviving parent keeps its declaration
  });

  test('removing the last token prunes the group it emptied', () => {
    const doc = createDocument();
    doc.hydrate({
      'core.json': { junk: { bland: { thing: { $value: '#000' } } } },
    });

    doc.apply(removeToken('core:junk.bland.thing'));

    // Nothing left to hold, so nothing is left behind — under a closed vocabulary a stranded
    // empty group is an illegal name no verb could clear.
    expect(doc.getFiles()['core.json']).toEqual({});
  });

  test('a group holding a declaration survives losing its last token', () => {
    const doc = withGroups();
    doc.apply(removeToken('core:space.1'));

    expect(
      (doc.getFiles()['core.json'] as Record<string, DtcgNode>).space,
    ).toEqual({ $type: 'dimension', $description: 'Scale' });
  });
});

test('updateTokenValue on a $ref token writes $value and drops $ref (mutual exclusivity)', () => {
  const doc = createDocument();
  doc.hydrate({
    'core.json': { base: { $value: 4 }, alias: { $ref: '#/base' } },
  });
  const alias = doc.getAllTokens().find((t) => t.path.join('.') === 'alias');
  doc.apply(updateTokenValue(String(alias?.id), 7));
  const files = doc.getFiles();
  expect((files['core.json'] as Record<string, unknown>).alias).toEqual({
    $value: 7,
  });
});
