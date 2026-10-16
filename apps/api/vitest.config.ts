import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Nest needs decorator metadata, which the default transform does not emit.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    name: 'api',
    include: ['src/**/*.test.ts'],
    env: {
      // CI sets DATABASE_URL. Locally the tests use the database that `pnpm db:start` runs.
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://monsport:monsport@localhost:55432/monsport_test',
    },
  },
});
