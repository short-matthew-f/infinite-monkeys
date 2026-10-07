import { defineConfig } from 'vitest/config';

// Separate from vite.config.ts so tests run from the repo root, not game/.
export default defineConfig({
  test: { include: ['tests/**/*.test.ts'] },
});
