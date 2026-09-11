import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Node environment, no jsdom: everything tested here is pure arithmetic that
 * turns a pointer movement into a spec value, plus the engine's answer to it.
 * A component harness would test React, which is not the part that can be wrong.
 */
export default defineConfig({
  resolve: {
    alias: { '@ale/engine': path.resolve(__dirname, '../../packages/engine/src/index.ts') },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
