import { createKernel } from 'vertekum';
import { expect, test } from 'vitest';
import { valueEditorsExtension } from './index';
import { VALUE_EDITOR_SERVICE, type ValueEditorService } from './value-editor';

function startedKernel() {
  const kernel = createKernel();
  kernel.register(valueEditorsExtension);
  kernel.start();
  return kernel;
}

test('activation publishes a service that resolves every built-in editor', () => {
  const svc =
    startedKernel().services.get<ValueEditorService>(VALUE_EDITOR_SERVICE);
  expect(svc?.resolve('color')).toBeTruthy();
  expect(svc?.resolve('dimension')).toBeTruthy();
  expect(svc?.resolve('number')).toBeTruthy();
  expect(svc?.resolve('fontWeight')).toBeTruthy();
  expect(svc?.resolve('boolean')).toBeTruthy();
});

test('resolve returns undefined for an unregistered type', () => {
  const svc =
    startedKernel().services.get<ValueEditorService>(VALUE_EDITOR_SERVICE);
  expect(svc?.resolve('shadow')).toBeUndefined();
});
