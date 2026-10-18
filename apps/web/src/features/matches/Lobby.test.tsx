import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Lobby } from './Lobby.tsx';

const m1 = {
  id: '0199a1b2-0000-7000-8000-000000000301',
  bookingId: '0199a1b2-0000-7000-8000-000000000201',
  hostId: '0199a1b2-0000-7000-8000-000000000101',
  hostName: 'An',
  sport: 'BADMINTON',
  capacity: 4,
  joinedCount: 1,
  pricePerSlot: 50_000,
  status: 'OPEN',
  bookingStatus: 'PENDING',
  startAt: '2026-11-20T13:00:00.000Z',
  endAt: '2026-11-20T14:00:00.000Z',
  courtName: 'Sân 1',
  venueName: 'Cầu lông A',
  venueAddress: '10 Nguyễn Huệ',
  createdAt: '2026-11-20T03:00:00.000Z',
};

const m2 = {
  ...m1,
  id: '0199a1b2-0000-7000-8000-000000000302',
  bookingId: '0199a1b2-0000-7000-8000-000000000202',
  hostName: 'Chi',
  sport: 'FOOTBALL',
  capacity: 10,
  joinedCount: 3,
  pricePerSlot: 60_000,
  bookingStatus: 'CONFIRMED',
  startAt: '2026-11-20T11:00:00.000Z',
  endAt: '2026-11-20T12:00:00.000Z',
  courtName: 'Sân 2',
};

describe('Lobby (F-011)', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('AC-16: renders matches with venue, court, time, sport, slots, price, host, and booking status badge, and filters by sport and date', async () => {
    const fetch = vi.fn((url: string) => {
      const body = url === '/api/matches' ? [m2, m1] : url === '/api/matches?sport=BADMINTON&date=2026-11-20' ? [m1] : [];
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
    });
    vi.stubGlobal('fetch', fetch);

    render(<Lobby />);
    expect(await screen.findByText('Cầu lông A · Sân 2')).toBeTruthy();
    expect(screen.getByText('Cầu lông A · Sân 1')).toBeTruthy();

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText('Bóng đá · Ngày 20/11/2026')).toBeTruthy();
    expect(within(items[0]).getByText('3/10 suất · 60.000đ/suất')).toBeTruthy();
    expect(within(items[0]).getByText('Host: Chi')).toBeTruthy();
    expect(within(items[0]).getByText('Đã xác nhận')).toBeTruthy();

    expect(within(items[1]).getByText('Cầu lông · Ngày 20/11/2026')).toBeTruthy();
    expect(within(items[1]).getByText('1/4 suất · 50.000đ/suất')).toBeTruthy();
    expect(within(items[1]).getByText('Host: An')).toBeTruthy();
    expect(within(items[1]).getByText('Chưa xác nhận')).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/^Môn thể thao/), { target: { value: 'BADMINTON' } });
    fireEvent.change(screen.getByLabelText(/^Ngày chơi/), { target: { value: '2026-11-20' } });

    await vi.waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/matches?sport=BADMINTON&date=2026-11-20', expect.anything()),
    );
    await vi.waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1));

    fireEvent.change(screen.getByLabelText(/^Ngày chơi/), { target: { value: '2026-11-21' } });
    expect((await screen.findByRole('status')).textContent).toContain('Chưa có trận nào đang mở');
  });
});
