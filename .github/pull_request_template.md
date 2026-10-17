## Issue

<!-- "Refs #<issue>" on each step. "Closes #<issue>" on the last step only. No line for a fix, chore, or docs change without an issue. -->
Refs #

## Brief and step

<!-- For example: docs/briefs/F-002-<slug>.md, step 1 of 3 (schema). -->

## Changes

-

## Acceptance criteria

<!-- One line for each AC that this pull request covers, with its test name. -->
- [ ] AC-1:

## How tested

<!-- Evidence: the test names, the command output, or a screenshot for a screen change. -->

## Risk

<!-- low, medium, or high, and why. For example: medium, because it changes the booking lock order. -->

## How to revert

<!-- Revert the merge commit with a new pull request. When the live service is broken, first shift Cloud Run traffic to the previous revision: gcloud run services update-traffic monsport --region asia-southeast1 --to-revisions <previous-revision>=100. Say when a migration needs more than that. -->

## Checks

- [ ] `pnpm check` passes.
- [ ] Each changed path is in the brief's list of paths.
- [ ] `PROGRESS.md` is rewritten, when the next step or an open decision changed.
- [ ] Money, concurrency, or schema change: a fresh session reviewed it. Link:
