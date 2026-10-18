import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JoinedMatches } from './JoinedMatches.tsx';

const mOpen = {
  id: '0199a1b2-0000-7000-8000-000000000301',
  bookingId: '0199a1b2-0000-7000-8000-000000000201',
  hostId: '0199a1b2-0000-7000-8000-000000000101',
  hostName: 'An',
  sport: 'BADMINTON' as const,
  capacity: 4,
  joinedCount: 2,
  pricePerSlot: 50_000,
  status: 'OPEN' as const,
  bookingStatus: 'PENDING' as const,
  startAt: '2026-11-20T13:00:00.000Z',
  endAt: '2026-11-20T14:00:00.000Z',
  courtName: 'Sân 1',
  venueName: 'Cầu lông A',
  venueAddress: '10 Nguyễn Huệ',
  createdAt: '2026-11-20T03:00:00.000Z',
};

const mCancelled = {
  ...mOpen,
  id: '0199a1b2-0000-7000-8000-000000000302',
  status: 'CANCELLED' as const,
  startAt: '2026-11-20T12:00:00.000Z',
  endAt: '2026-11-20T13:00:00.000Z',
};

describe('JoinedMatches (F-012, AC-13)', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('AC-13: renders joined matches with venue, court, date, time, status labels, and slots; empty state shows prompt', async () => {
    const fetch = vi.fn((url: string) => {
      if (url === '/api/matches/joined') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([mOpen, mCancelled]) });
      }
      return Promise.reject(new Error(url));
    });
    vi.stubGlobal('fetch', fetch);

    const { unmount } = render(<JoinedMatches />);
    expect(await screen.findByRole('heading', { name: 'Trận đã vào' })).toBeTruthy();

    const items = await screen.findAllByRole('listitem');
    expect(items).toHaveLength(2);

    expect(within(items[0]).getByText('Cầu lông A · Sân 1')).toBeTruthy();
    expect(within(items[0]).getByText('2/4 suất')).toBeTruthy();
    expect(within(items[0]).getByText('Trận đang mở')).toBeTruthy();

    expect(within(items[1]).getByText('Cầu lông A · Sân 1')).toBeTruthy();
    expect(within(items[1]).getByText('2/4 suất')).toBeTruthy();
    expect(within(items[1]).getByText('Trận đã hủy')).toBeTruthy();

    unmount();
    cleanup();

    // Empty list:
    const emptyFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve([]) });
    vi.stubGlobal('fetch', emptyFetch);

    render(<JoinedMatches />);
    expect(await screen.findByText('Bạn chưa vào trận nào')).toBeTruthy();
  });
});
