import { expect, test } from 'vitest';
import { hookSkips } from '../scripts/hook-skip.mjs';

// The Stop hook skips a read-only session: a plan-mode session (the Reviewer, a parity run)
// edits nothing, and its check would race the author's check on the shared test database.
test('the Stop hook skips a plan-mode session, a clean tree, and its own rerun', () => {
  expect(hookSkips({ permission_mode: 'plan' }, false)).toBe(true);
  expect(hookSkips({ stop_hook_active: true }, false)).toBe(true);
  expect(hookSkips({}, true)).toBe(true);
  expect(hookSkips({ permission_mode: 'acceptEdits' }, false)).toBe(false);
  expect(hookSkips({ permission_mode: 'bypassPermissions' }, false)).toBe(false);
});
