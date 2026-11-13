// Proves the decisions of scripts/doc-size.mjs: the files that every session reads stay short,
// in lines and in characters, because one line can hold a whole paragraph.

import { expect, test } from 'vitest';
import { DOC_LIMITS, sizeFailures } from '../scripts/doc-size.mjs';

const limit = { lines: 3, chars: 20 };

test('a file inside both limits passes', () => {
  expect(sizeFailures('X.md', 'a\nb\nc\n', limit)).toEqual([]);
});

test('a file with too many lines fails and names the limit', () => {
  const [failure] = sizeFailures('X.md', 'a\nb\nc\nd', limit);
  expect(failure).toContain('FAIL size: X.md has 4 lines and the limit is 3');
});

test('a file with few lines but too many characters fails', () => {
  const [failure] = sizeFailures('X.md', 'a'.repeat(21), limit);
  expect(failure).toContain('FAIL size: X.md has 21 characters and the limit is 20');
});

test('the characters are counted, not the UTF-8 bytes', () => {
  expect(sizeFailures('X.md', 'Đặt sân'.repeat(2), { lines: 1, chars: 14 })).toEqual([]);
});

test('trailing blank lines do not count', () => {
  expect(sizeFailures('X.md', 'a\nb\nc\n\n\n', limit)).toEqual([]);
});

test('PROGRESS.md and AGENTS.md have a line limit and a character limit', () => {
  expect(DOC_LIMITS['PROGRESS.md']).toEqual({ lines: 40, chars: 10000 });
  expect(DOC_LIMITS['AGENTS.md']).toEqual({ lines: 100, chars: 10000 });
});
