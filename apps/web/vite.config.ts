import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Same-origin in development, so the session cookie behaves exactly as it
    // will in production behind one domain.
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
  // The engine is TypeScript source in a sibling workspace, not a built package.
  // Vite must compile it rather than treat it as a pre-bundled dependency.
  optimizeDeps: { exclude: ['@ale/engine', '@ale/shared'] },
  build: { outDir: 'dist', sourcemap: true },
});
