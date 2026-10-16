import { describe, expect, it } from 'vitest';
import { HealthResponse } from './health.ts';

describe('HealthResponse', () => {
  it('accepts a healthy response', () => {
    expect(HealthResponse.parse({ status: 'ok', db: 'up' })).toEqual({ status: 'ok', db: 'up' });
  });

  it('rejects an unknown database state', () => {
    expect(HealthResponse.safeParse({ status: 'ok', db: 'maybe' }).success).toBe(false);
  });
});
