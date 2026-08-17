import { defineConfig } from 'vertekum';
import defaultConfig from 'vertekum/default-config';

// Extend the default Vertekum config, pointed at this package's local token files.
export default defineConfig({
  ...defaultConfig,
  collection: './tokens',
});
