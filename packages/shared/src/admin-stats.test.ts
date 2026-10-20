import { describe, expect, it } from 'vitest';
import { AdminStatsQuerySchema, AdminStatsView, AdminVenueStat } from './admin-stats.ts';

const VENUE_A = '11111111-1111-4111-8111-111111111111';
const VENUE_B = '22222222-2222-4222-8222-222222222222';

const venues = [
  { venueId: VENUE_A, venueName: 'Cầu lông A', bookingCount: 4, matchCount: 1 },
  { venueId: VENUE_B, venueName: 'Cầu lông B', bookingCount: 0, matchCount: 0 },
];

const view = {
  date: '2026-11-20',
  weekStart: '2026-11-16',
  weekEnd: '2026-11-22',
  accounts: { ADMIN: 1, OWNER: 3, USER: 40 },
  newUsers: 5,
  activeUsers: 3,
  avgConfirmMinutes: 25,
  expiryRate: 0.2,
  venues,
};

describe('admin stats query contract, brief F-016', () => {
  it('F-016 contract for AC-9: rejects a date that is not a date', () => {
    for (const date of ['2026-13-45', 'abc', '2026-02-30', '', '20-11-2026', '2026-1-1', '0000-01-01', '1999-12-31', '3000-01-01', '9999-12-31']) {
      expect(AdminStatsQuerySchema.safeParse({ date }).success).toBe(false);
    }
  });

  it('F-016 contract for AC-9: accepts a real date and an absent date', () => {
    expect(AdminStatsQuerySchema.parse({ date: '2026-11-20' })).toEqual({ date: '2026-11-20' });
    expect(AdminStatsQuerySchema.parse({ date: '2028-02-29' })).toEqual({ date: '2028-02-29' });
    expect(AdminStatsQuerySchema.parse({})).toEqual({});
    expect(AdminStatsQuerySchema.parse({ date: undefined })).toEqual({});
  });
});

describe('admin stats view contract, brief F-016', () => {
  it('F-016 contract for AC-1: parses a valid view', () => {
    expect(AdminStatsView.parse(view)).toEqual(view);
  });

  it('F-016 contract for AC-7: accepts a null avgConfirmMinutes, an expiryRate of 0, and no venue', () => {
    const empty = { ...view, avgConfirmMinutes: null, expiryRate: 0, venues: [] };
    expect(AdminStatsView.parse(empty)).toEqual(empty);
  });

  it('F-016 contract for AC-6: accepts an expiryRate from 0 to 1 and refuses a rate above 1 or below 0', () => {
    expect(AdminStatsView.safeParse({ ...view, expiryRate: 1 }).success).toBe(true);
    expect(AdminStatsView.safeParse({ ...view, expiryRate: 1.01 }).success).toBe(false);
    expect(AdminStatsView.safeParse({ ...view, expiryRate: -0.1 }).success).toBe(false);
  });

  it('F-016 contract for AC-5: refuses an avgConfirmMinutes that is not a whole non-negative number', () => {
    expect(AdminStatsView.safeParse({ ...view, avgConfirmMinutes: 25.5 }).success).toBe(false);
    expect(AdminStatsView.safeParse({ ...view, avgConfirmMinutes: -1 }).success).toBe(false);
    expect(AdminStatsView.safeParse({ ...view, avgConfirmMinutes: 0 }).success).toBe(true);
  });

  it('F-016 contract for AC-1: refuses a negative or fractional count', () => {
    expect(AdminStatsView.safeParse({ ...view, newUsers: -1 }).success).toBe(false);
    expect(AdminStatsView.safeParse({ ...view, activeUsers: 1.5 }).success).toBe(false);
    expect(AdminStatsView.safeParse({ ...view, accounts: { ...view.accounts, USER: -1 } }).success).toBe(false);
    expect(AdminStatsView.safeParse({ ...view, accounts: { ADMIN: 1, OWNER: 3 } }).success).toBe(false);
  });

  it('F-016 contract for AC-4: a venue stat needs a uuid and counts that are whole and not negative', () => {
    expect(AdminVenueStat.parse(venues[0])).toEqual(venues[0]);
    expect(AdminVenueStat.safeParse({ ...venues[0], venueId: 'not-a-uuid' }).success).toBe(false);
    expect(AdminVenueStat.safeParse({ ...venues[0], bookingCount: -1 }).success).toBe(false);
    expect(AdminVenueStat.safeParse({ ...venues[0], matchCount: 0.5 }).success).toBe(false);
    expect(AdminStatsView.safeParse({ ...view, venues: [{ ...venues[0], bookingCount: -1 }] }).success).toBe(false);
  });

  it('F-016 contract for AC-13: refuses a response that is not an AdminStatsView', () => {
    expect(AdminStatsView.safeParse({}).success).toBe(false);
    expect(AdminStatsView.safeParse(null).success).toBe(false);
    expect(AdminStatsView.safeParse({ ...view, venues: 'none' }).success).toBe(false);
  });

  it('keeps personal data out: the view has no phone field', () => {
    expect(Object.keys(AdminStatsView.shape)).not.toContain('phone');
    expect(Object.keys(AdminVenueStat.shape)).not.toContain('phone');
    const parsed = AdminStatsView.parse({ ...view, phone: '0912345678', venues: [{ ...venues[0], phone: '0912345678' }] });
    expect(JSON.stringify(parsed)).not.toContain('0912345678');
  });
});
