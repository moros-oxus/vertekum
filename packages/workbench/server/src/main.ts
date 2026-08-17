import { resolve } from 'node:path';
import { createBridgeServer } from './server';

// Standalone bridge entry (single-root: metadata + artifacts alongside the collection). The
// canonical dev flow is `vertekum dev` (dual-root); this is a bare bridge for smoke tests and
// requires an explicit collection dir — no baked-in default.
const arg = process.argv[2] ?? process.env.VTK_COLLECTION;
if (!arg) {
  throw new Error(
    'bridge: a collection dir is required (pass an argument or set VTK_COLLECTION). ' +
      'For normal development use `vertekum dev`.',
  );
}
const dir = resolve(arg);
const port = Number(process.env.VTK_PORT ?? 5174);

createBridgeServer(dir).listen(port, () => {
  console.log(
    `vtk bridge server → http://localhost:${port}  collection: ${dir}`,
  );
});
