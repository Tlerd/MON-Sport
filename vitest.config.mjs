import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Each package keeps its own config: the API needs SWC for decorators, the web needs jsdom.
    projects: [
      { test: { name: 'harness', include: ['harness/**/*.test.mjs'] } },
      'packages/*/vitest.config.ts',
      'apps/*/vitest.config.ts',
    ],
  },
});
