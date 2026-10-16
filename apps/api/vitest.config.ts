import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';
import { TEST_DATABASE_URL } from './test/database-url.js';

export default defineConfig({
  // Nest needs decorator metadata, which the default transform does not emit.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    name: 'api',
    include: ['src/**/*.test.ts', 'prisma/**/*.test.ts'],
    globalSetup: ['test/migrate.ts'],
    env: { DATABASE_URL: TEST_DATABASE_URL },
  },
});
