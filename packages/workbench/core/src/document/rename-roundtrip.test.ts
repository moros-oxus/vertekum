import { expect, test } from 'vitest';
import { serializeSets } from '../dtcg/serialize';
import { serializeDocument } from '../storage/provider';
import { renamePath } from './commands';
import { createDocument } from './document';

/** Renaming must survive serialization: the emitted files carry the new paths AND the new refs. */
test('a group rename round-trips through the DTCG files', () => {
  const doc = createDocument();
  doc.hydrate(
    serializeDocument(
      [
        {
          id: 'c1',
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

  doc.apply(
    renamePath(['color', 'red'], ['color', 'danger'], { allowGroup: true }),
  );

  const files = serializeSets(doc.getAllTokens(), doc.getSets());
  const core = JSON.stringify(files['core.json']);
  const light = JSON.stringify(files['light.json']);

  expect(core).toContain('danger');
  expect(core).not.toContain('"red"');
  expect(light).toContain('{color.danger.900}');
});

test('a rename rewrites $ref pointers in the raw files, and they still resolve', () => {
  const doc = createDocument();
  doc.hydrate({
    'core.json': {
      base: { $value: 4 },
      alias: { $ref: '#/base' },
      wrapped: { $value: { $ref: '#/base/$value' } },
    },
  });
  doc.apply(renamePath(['base'], ['ground']));

  const core = doc.getFiles()['core.json'] as Record<string, unknown>;
  expect(core.ground).toEqual({ $value: 4 });
  expect(core.alias).toEqual({ $ref: '#/ground' });
  expect(core.wrapped).toEqual({ $value: { $ref: '#/ground/$value' } });

  // the re-derived model resolves both — no refIssue, no surviving marker
  const byPath = new Map(doc.getAllTokens().map((t) => [t.path.join('.'), t]));
  expect(byPath.get('alias')?.refIssue).toBeUndefined();
  expect(byPath.get('alias')?.value).toBe(4);
  expect(byPath.get('wrapped')?.value).toBe(4);
});
