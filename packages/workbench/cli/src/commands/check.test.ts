import { createDocument } from 'vertekum/core';
import { expect, test } from 'vitest';
import { collectRelational } from './check';

test('spec-mandated validators run with NO extensions installed', async () => {
  const document = createDocument();
  document.hydrate({
    'core.json': {
      a: { $type: 'color', $value: '{missing.token}' },
      b: { $ref: '#/nope' },
    },
  });
  // A bare kernel: no validator registry was ever published — the built-ins must still fire.
  const project = {
    document,
    kernel: { services: { get: () => undefined } },
  } as never;

  const diagnostics = await collectRelational(project);
  const codes = diagnostics.map((d) => d.code);
  expect(codes).toContain('token/dangling-alias');
  expect(codes).toContain('token/dangling-pointer');
});
