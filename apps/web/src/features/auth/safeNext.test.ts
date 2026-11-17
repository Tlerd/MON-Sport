import { describe, expect, it } from 'vitest';
import { safeNext } from './safeNext.ts';

describe('safeNext (F-038)', () => {
  it('AC-17: accepts a path of this site, with its query', () => {
    expect(safeNext('/ket-noi-ai/cho-phep?yeu-cau=abc')).toBe('/ket-noi-ai/cho-phep?yeu-cau=abc');
  });

  it('AC-17: refuses an absolute URL', () => {
    expect(safeNext('https://evil.example/x')).toBeNull();
  });

  it('AC-17: refuses a protocol-relative URL', () => {
    expect(safeNext('//evil.example')).toBeNull();
  });

  it('AC-17: refuses a backslash', () => {
    expect(safeNext('/\\evil.example')).toBeNull();
  });

  it('AC-17: refuses an empty or missing value', () => {
    expect(safeNext('')).toBeNull();
    expect(safeNext(null)).toBeNull();
  });
});
