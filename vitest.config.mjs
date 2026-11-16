import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Each package keeps its own config: the API needs SWC for decorators, the web needs jsdom.
    projects: [
      // The harness tests spawn git, gitleaks, and depcruise, so they need more than 5 s under load.
      { test: { name: 'harness', include: ['harness/**/*.test.mjs'], testTimeout: 30_000 } },
      'packages/*/vitest.config.ts',
      'apps/*/vitest.config.ts',
    ],
  },
});
