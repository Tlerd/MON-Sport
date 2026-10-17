// When the Stop hook of `pnpm check` has nothing to check.
// A plan-mode session edits nothing, and its check would race the author's check on the test database.
export const hookSkips = (input, treeIsClean) =>
  Boolean(input.stop_hook_active) || input.permission_mode === 'plan' || treeIsClean;
