// When the Stop hook of `pnpm check` has nothing to check.
// A plan-mode session edits nothing, and its check would race the author's check on the test database.
// Limit: a session that edits and then switches to plan mode before it stops also skips. The git hook
// and CI still run the check on its commit.
export const hookSkips = (input, treeIsClean) =>
  Boolean(input.stop_hook_active) || input.permission_mode === 'plan' || treeIsClean;
