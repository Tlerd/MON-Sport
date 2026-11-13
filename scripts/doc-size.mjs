// Size limits for the files that every session reads. A line limit alone lets one line hold
// a whole paragraph, so each file also has a character limit.

export const DOC_LIMITS = {
  'AGENTS.md': { lines: 100, chars: 10000 },
  'PROGRESS.md': { lines: 40, chars: 10000 },
};

const FIX =
  'Fix: keep what the next session needs. Move a done feature to COMPLETED.md, ' +
  'and the rest into code, a test, or a commit message.';

/** Returns one failure message for each limit that `text` breaks. */
export function sizeFailures(file, text, limit) {
  const body = text.trimEnd();
  const lines = body.split('\n').length;
  // NFC, so a Vietnamese letter counts once, also when an editor saved the file in NFD.
  const chars = [...body.normalize('NFC')].length;
  const failures = [];
  if (lines > limit.lines) {
    failures.push(`FAIL size: ${file} has ${lines} lines and the limit is ${limit.lines}\n${FIX}`);
  }
  if (chars > limit.chars) {
    failures.push(`FAIL size: ${file} has ${chars} characters and the limit is ${limit.chars}\n${FIX}`);
  }
  return failures;
}
