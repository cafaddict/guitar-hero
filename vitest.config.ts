import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: { __GH_E2E__: 'false' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'tests/integrity/**/*.test.ts', 'tools/**/*.test.ts'],
    testTimeout: 30_000,
    pool: 'threads',
  },
});
