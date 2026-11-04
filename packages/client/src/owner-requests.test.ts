import { describe, expect, it } from 'vitest';
import type { VenueView } from '@monsport/shared';
import { courtLabels, deadlineLeft } from './owner-requests.ts';

const now = new Date('2026-11-06T15:30:00+07:00');

describe('deadlineLeft', () => {
  it.each([
    ['2026-11-06T17:35:00+07:00', 'Còn 2 giờ 5 phút'],
    ['2026-11-06T17:29:59+07:00', 'Còn 1 giờ 59 phút'],
    ['2026-11-06T16:15:00+07:00', 'Còn 45 phút'],
    ['2026-11-06T15:30:30+07:00', 'Còn dưới 1 phút'],
    ['2026-11-06T15:30:00+07:00', 'Hết hạn'],
    ['2026-11-06T15:29:00+07:00', 'Hết hạn'],
    ['2026-11-06T17:30:00+07:00', 'Còn 2 giờ'],
  ])('AC-12: %s gives %s', (deadline, expected) => {
    expect(deadlineLeft(deadline, now)).toBe(expected);
  });

  it('AC-12: null gives an empty string', () => {
    expect(deadlineLeft(null, now)).toBe('');
  });

  it('AC-12: an unreadable deadline "x" gives an empty string', () => {
    expect(deadlineLeft('x', now)).toBe('');
  });
});

const venue = (id: string, name: string, courts: [string, string][]): VenueView => ({
  id,
  name,
  address: 'a',
  phone: '0901234567',
  opensAt: 360,
  closesAt: 1320,
  courts: courts.map(([cid, cname]) => ({
    id: cid,
    name: cname,
    sport: 'BADMINTON',
    priceNormal: 100000,
    pricePeak: 120000,
  })),
});

describe('courtLabels', () => {
  it('AC-13: maps every court of every venue', () => {
    const map = courtLabels([
      venue('v1', 'An Phú', [
        ['c1', 'Sân 1'],
        ['c2', 'Sân 2'],
      ]),
      venue('v2', 'Bình Thạnh', [
        ['c3', 'Sân A'],
        ['c4', 'Sân B'],
      ]),
    ]);
    expect(map.size).toBe(4);
    expect(map.get('c1')).toEqual({ courtName: 'Sân 1', venueName: 'An Phú' });
    expect(map.get('c4')).toEqual({ courtName: 'Sân B', venueName: 'Bình Thạnh' });
  });

  it('AC-13: an empty list gives an empty map', () => {
    expect(courtLabels([]).size).toBe(0);
  });
});
