// Proves the decisions of scripts/ac-check.mjs: each AC that a pull request lists has a test
// whose name starts with its label.

import { expect, test } from 'vitest';
import { listedAcs, missingAcs, testedAcs } from '../scripts/ac-check.mjs';

test('the description lists the ACs it covers; an unfilled template line does not count', () => {
  const body = ['## Acceptance criteria', '- [x] AC-1: BookingForm.test.tsx "AC-1: shows"', '- [ ] AC-12: other test', '- [ ] AC-3:', 'AC-9 in prose'].join('\n');
  expect(listedAcs(body)).toEqual(['AC-1', 'AC-12']);
});

test('a test title starts with the label, on its own line or after the call', () => {
  const text = ["it('AC-1: shows', () => {});", 'test(', "  'AC-12: long title that wraps',", '  async () => {});', "it('AC-2 and AC-3: both', () => {});", "// Brief F-008 (AC-14): comment only"].join('\n');
  expect([...testedAcs(text)].sort()).toEqual(['AC-1', 'AC-12', 'AC-2']);
});

test('AC-1 does not match a test named AC-12, and a missing AC is reported', () => {
  expect(missingAcs(['AC-1', 'AC-12', 'AC-4'], new Set(['AC-12']))).toEqual(['AC-1', 'AC-4']);
});
