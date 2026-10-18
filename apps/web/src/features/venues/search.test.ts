import type { VenueView } from '@monsport/shared';
import { describe, expect, it } from 'vitest';
import { findVenues, normalizeName } from './search.ts';

const venue = (name: string, courts: string[]): VenueView => ({
  id: name, name, address: 'A', phone: '0912345678', opensAt: 360, closesAt: 1380,
  courts: courts.map((c) => ({ id: `${name}/${c}`, name: c, sport: 'BADMINTON', priceNormal: 80_000, pricePeak: 120_000 })),
});
const VENUES = [venue('Cầu lông B', ['Sân 1']), venue('Cầu lông A', ['Sân 1', 'Sân 2', 'Sân 10']), venue('Bóng đá C', ['Sân Đông'])];

describe('normalizeName', () => {
  it('AC-2: ignores case and accents, and maps đ and Đ to d', () => {
    expect(normalizeName('SÂN 1')).toBe('san 1');
    expect(normalizeName('Sân Đông')).toBe('san dong');
    expect(normalizeName('đông ĐÔNG')).toBe('dong dong');
  });

  it('AC-2: strips the marks of ơ ư ă â ê ô', () => {
    expect(normalizeName('Sân Mơ Ưu Ăn Ân Êm Ôn')).toBe('san mo uu an an em on');
  });

  it('AC-2: collapses runs of spaces and trims both ends', () => {
    expect(normalizeName('  Sân   1 ')).toBe('san 1');
    expect(normalizeName('\tSân 1')).toBe('san 1');
  });
});

describe('findVenues', () => {
  it('AC-1: lists the venues with a matching court, by venue name, with the matching courts', () => {
    const found = findVenues(VENUES, 'Sân 1');
    expect(found.map((m) => m.venue.name)).toEqual(['Cầu lông A', 'Cầu lông B']);
    expect(found[0].courts.map((c) => c.name)).toEqual(['Sân 1', 'Sân 10']);
    expect(found[1].courts.map((c) => c.name)).toEqual(['Sân 1']);
  });

  it('AC-2: "san dong" finds only "Sân Đông"', () => {
    expect(findVenues(VENUES, 'san dong').map((m) => m.venue.name)).toEqual(['Bóng đá C']);
  });

  it('AC-2: a double space in the query still matches', () => {
    expect(findVenues(VENUES, 'san  1').map((m) => m.venue.name)).toEqual(['Cầu lông A', 'Cầu lông B']);
  });

  it('AC-4: finds nothing for "xyz"', () => {
    expect(findVenues(VENUES, 'xyz')).toEqual([]);
  });

  it('AC-5: an empty query, or spaces only, finds nothing', () => {
    expect(findVenues(VENUES, '')).toEqual([]);
    expect(findVenues(VENUES, '   ')).toEqual([]);
  });

  it('does not match a venue name', () => {
    expect(findVenues(VENUES, 'cau long')).toEqual([]);
  });
});
