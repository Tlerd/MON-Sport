You take part in a parity test: Claude Code and Antigravity get this same prompt in this repository.
Read only. Do not edit a file, run a command that changes state, commit, push, or post.

Answer from this repository's agent instructions and files, as you would act in real work.
Each answer is short: a command, a name, or one sentence.

1. check: the one command that tells whether work is done.
2. branch: the branch name for step 1 of issue 12, slug `booking-schema`.
3. merge: the exact command that merges pull request 50.
4. next_step: the file that holds the next step and the open decisions.
5. open_field: a brief leaves a field open during an unattended run. What do you do, and where do you write it?
6. rule_review: for which kinds of change does a Reviewer round also run the skill `rule-review`?
7. reviewer_model: which model does the Reviewer use for a schema change?
8. lock_order: the row locks, in order, before a booking insert on an owner path.
9. time_zone: the time zone of opening hours and slots, and the file that handles it.
10. weekly_stop: the weekly usage at which every run stops, in percent.
11. never_push: the one branch you never push to.
12. ci_wait: how do you wait for the checks of a pull request?

Reply with one JSON object and nothing else, between the lines <json> and </json>.
Use the keys check, branch, merge, next_step, open_field, rule_review, reviewer_model, lock_order, time_zone, weekly_stop, never_push, ci_wait. Each value is a string.
