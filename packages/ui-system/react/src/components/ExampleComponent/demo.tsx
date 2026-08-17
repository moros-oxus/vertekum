/** biome-ignore-all assist/source/organizeImports: only for example */

import { VtkExamplePrimitive } from './index';

import { VtkExample, VtkExampleContent, VtkExampleHeader } from './index';

export const Example = () => {
  return (
    <>
      <VtkExamplePrimitive.Root>
        <VtkExamplePrimitive.Header></VtkExamplePrimitive.Header>
        <VtkExamplePrimitive.Content></VtkExamplePrimitive.Content>
      </VtkExamplePrimitive.Root>

      <VtkExample>
        <VtkExampleHeader></VtkExampleHeader>
        <VtkExampleContent></VtkExampleContent>
      </VtkExample>
    </>
  );
};
