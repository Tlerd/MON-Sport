// CI sets DATABASE_URL. Locally the tests use the test database that `pnpm db:start` runs.
export const TEST_DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://monsport:monsport@localhost:55432/monsport_test';
