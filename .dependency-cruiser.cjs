// Import rules for the whole repo. `pnpm check` runs them.
// Each comment says what is wrong, why it matters, and how to fix it.
// dependency-cruiser 18 reads TypeScript through the root `typescript` package and
// supports it below version 7. With version 7 it finds 0 modules and passes everything.
// harness/boundaries.test.mjs fails when that happens.

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'feature-imports-feature',
      severity: 'error',
      comment:
        'A web feature imports another web feature. Features stay independent so that one can change without the other. ' +
        'Fix: move the shared code to apps/web/src/components, hooks, or lib, or compose both features in apps/web/src/app.',
      from: { path: '^apps/web/src/features/([^/]+)/' },
      to: { path: '^apps/web/src/features/', pathNot: '^apps/web/src/features/$1/' },
    },
    {
      name: 'feature-imports-app',
      severity: 'error',
      comment:
        'A web feature imports from apps/web/src/app. The app layer composes features, so the import must point the other way. ' +
        'Fix: pass the value in as a prop or argument, or move it to apps/web/src/lib.',
      from: { path: '^apps/web/src/features/' },
      to: { path: '^apps/web/src/app/' },
    },
    {
      name: 'shared-imports-feature',
      severity: 'error',
      comment:
        'Shared web code (components, hooks, lib) imports a feature or the app layer. Shared code must work for every feature. ' +
        'Fix: move the feature-specific part into that feature, or pass it in as a prop or argument.',
      from: { path: '^apps/web/src/(components|hooks|lib)/' },
      to: { path: '^apps/web/src/(features|app)/' },
    },
    {
      name: 'tournaments-imports-booking',
      severity: 'error',
      comment:
        'The tournaments module imports bookings or payments. Tournaments are not in the intake yet. When they come, they must ship without bookings or payments. ' +
        'Fix: depend on a port that tournaments owns, and let bookings or payments implement it.',
      from: { path: '^apps/api/src/modules/tournaments/' },
      to: { path: '^apps/api/src/modules/(bookings|payments)/' },
    },
    {
      name: 'app-imports-app',
      severity: 'error',
      comment:
        'One app imports source files of another app. Apps share code only through packages. ' +
        'Fix: move the shared type or schema to packages/shared.',
      from: { path: '^apps/([^/]+)/' },
      to: { path: '^apps/', pathNot: '^apps/$1/' },
    },
    {
      name: 'package-imports-app',
      severity: 'error',
      comment:
        'A package imports from an app. Packages are the bottom layer, so an app can depend on them and not the reverse. ' +
        'Fix: move the code the package needs into the package.',
      from: { path: '^packages/' },
      to: { path: '^apps/' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      comment:
        'These files import each other in a circle. ' +
        'Fix: move the part both sides need into a third file that imports neither.',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    // Prisma generates this client. Its files import each other in circles, and nobody edits them.
    exclude: { path: '^apps/api/src/generated/' },
    tsPreCompilationDeps: true,
  },
};
