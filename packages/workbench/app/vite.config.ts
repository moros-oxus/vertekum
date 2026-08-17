import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { vertekumConfigPlugin } from './src/vite/vertekumConfigPlugin';

export default defineConfig({
  plugins: [react(), vertekumConfigPlugin()],
  server: {
    port: Number(process.env.VTK_APP_PORT ?? 5173),
    proxy: {
      // Proxy the local bridge server (ADR-0015) so the app stays same-origin.
      '/api': `http://localhost:${process.env.VTK_BRIDGE_PORT ?? 5174}`,
    },
  },
});
