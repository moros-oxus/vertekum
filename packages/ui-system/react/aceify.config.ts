import { jsx } from '@aceify/plugin-jsx';
import { defineConfig } from 'aceify';

// Dogfood: generate the JSX element types for @vertekum-ui/react's custom tags.
export default defineConfig({
  prefix: 'vtk',
  specs: ['src/**/*.aces.html'],
  // Foundational types the components build against → emit the .d.ts into src/.
  plugins: [jsx({ outDir: './src' })],
});
