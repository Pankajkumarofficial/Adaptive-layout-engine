import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  // The engine is TypeScript source in a sibling workspace, not a built package.
  // Vite must compile it rather than treat it as a pre-bundled dependency.
  optimizeDeps: { exclude: ['@ale/engine', '@ale/shared'] },
  build: { outDir: 'dist', sourcemap: true },
});
