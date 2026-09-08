import { describe, expect, it } from 'vitest';
import { SHARED_PACKAGE_READY } from './index';

describe('@monsport/shared', () => {
  it('resolves from the workspace', () => {
    expect(SHARED_PACKAGE_READY).toBe(true);
  });
});
