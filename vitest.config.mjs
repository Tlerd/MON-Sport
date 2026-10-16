import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['harness/**/*.test.mjs', '{apps,packages}/**/*.test.{ts,tsx}'],
  },
});
