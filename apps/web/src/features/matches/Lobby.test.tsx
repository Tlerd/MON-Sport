import type { MatchDetailView, SessionUser } from '@monsport/shared';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Lobby } from './Lobby.tsx';

const m1 = {
  id: '0199a1b2-0000-7000-8000-000000000301',
  bookingId: '0199a1b2-0000-7000-8000-000000000201',
  hostId: '0199a1b2-0000-7000-8000-000000000101',
  hostName: 'An',
  sport: 'BADMINTON' as const,
  capacity: 4,
  joinedCount: 1,
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

const m2 = {
  ...m1,
  id: '0199a1b2-0000-7000-8000-000000000302',
  bookingId: '0199a1b2-0000-7000-8000-000000000202',
  hostName: 'Chi',
  sport: 'FOOTBALL' as const,
  capacity: 10,
  joinedCount: 3,
  pricePerSlot: 60_000,
  bookingStatus: 'CONFIRMED' as const,
  startAt: '2026-11-20T11:00:00.000Z',
  endAt: '2026-11-20T12:00:00.000Z',
  courtName: 'Sân 2',
};

describe('Lobby (F-011 and F-012)', () => {
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

  it('AC-11: match detail view, join/leave cycle, 409 alert, host tel links without leave button, and guest login prompt', async () => {
    const chiUser: SessionUser = { id: '0199a1b2-0000-7000-8000-000000000102', name: 'Chi', role: 'USER' };
    const anHost: SessionUser = { id: m1.hostId, name: 'An', role: 'USER' };

    const matchT = { ...m1, joinedCount: 2, capacity: 4 };
    const detailTNone: MatchDetailView = {
      ...matchT,
      viewerRole: 'NONE',
      players: [
        { userId: m1.hostId, name: 'An', phone: null, joinedAt: '2026-11-20T03:00:00.000Z' },
        { userId: '0199a1b2-0000-7000-8000-000000000103', name: 'Em', phone: null, joinedAt: '2026-11-20T03:01:00.000Z' },
      ],
    };
    const detailTJoined: MatchDetailView = {
      ...matchT,
      joinedCount: 3,
      viewerRole: 'PLAYER',
      players: [
        ...detailTNone.players,
        { userId: chiUser.id, name: 'Chi', phone: null, joinedAt: '2026-11-20T03:02:00.000Z' },
      ],
    };
    const detailTHost: MatchDetailView = {
      ...matchT,
      viewerRole: 'HOST',
      players: [
        { userId: m1.hostId, name: 'An', phone: '0901234567', joinedAt: '2026-11-20T03:00:00.000Z' },
        { userId: '0199a1b2-0000-7000-8000-000000000103', name: 'Em', phone: '0901234569', joinedAt: '2026-11-20T03:01:00.000Z' },
      ],
    };

    let joinCount = 0;
    const fetch = vi.fn((url: string, options?: RequestInit) => {
      if (url === '/api/matches') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([matchT]) });
      }
      if (url === `/api/matches/${m1.id}`) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(detailTNone) });
      }
      if (url === `/api/matches/${m1.id}/join` && options?.method === 'POST') {
        joinCount++;
        if (joinCount === 1) {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(detailTJoined) });
        }
        return Promise.resolve({ ok: false, status: 409, json: () => Promise.resolve({ message: 'Trận đã đủ người' }) });
      }
      if (url === `/api/matches/${m1.id}/leave` && options?.method === 'POST') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(detailTNone) });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });
    vi.stubGlobal('fetch', fetch);

    // 1. Chi logs in and views details of match T.
    const { unmount } = render(<Lobby user={chiUser} />);
    expect(await screen.findByText('Cầu lông A · Sân 1')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Xem chi tiết' }));
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledWith(`/api/matches/${m1.id}`, expect.anything()));

    expect(await screen.findByText('Còn 2 suất trống')).toBeTruthy();
    expect(screen.getByText('50.000đ/suất')).toBeTruthy();
    expect(screen.getByText('An')).toBeTruthy();
    expect(screen.getByText('Em')).toBeTruthy();

    // 2. Chi clicks "Vào trận" -> receives 200 and sees "Rời trận".
    fireEvent.click(screen.getByRole('button', { name: 'Vào trận' }));
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledWith(`/api/matches/${m1.id}/join`, expect.anything()));
    expect(await screen.findByRole('button', { name: 'Rời trận' })).toBeTruthy();

    // 3. Chi clicks "Rời trận" -> receives 200 and sees "Vào trận".
    fireEvent.click(screen.getByRole('button', { name: 'Rời trận' }));
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledWith(`/api/matches/${m1.id}/leave`, expect.anything()));
    expect(await screen.findByRole('button', { name: 'Vào trận' })).toBeTruthy();

    // 4. Second time Chi clicks "Vào trận" -> API returns 409 "Trận đã đủ người".
    fireEvent.click(screen.getByRole('button', { name: 'Vào trận' }));
    await vi.waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByRole('alert').textContent).toContain('Trận đã đủ người');

    unmount();
    cleanup();

    // 5. Host views match: player phones have tel: links and there is no "Rời trận" button.
    const hostFetch = vi.fn((url: string) => {
      if (url === '/api/matches') return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([matchT]) });
      if (url === `/api/matches/${m1.id}`) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(detailTHost) });
      return Promise.reject(new Error(url));
    });
    vi.stubGlobal('fetch', hostFetch);

    const hostRender = render(<Lobby user={anHost} />);
    fireEvent.click(await hostRender.findByRole('button', { name: 'Xem chi tiết' }));
    const telLink = await hostRender.findByRole('link', { name: /0901234567/ });
    expect(telLink.getAttribute('href')).toBe('tel:0901234567');
    expect(hostRender.queryByRole('button', { name: 'Rời trận' })).toBeNull();

    hostRender.unmount();
    cleanup();

    // 6. Unauthenticated guest clicks "Xem chi tiết": sees "Đăng nhập để vào trận" and web does NOT call GET /api/matches/<id>.
    const guestFetch = vi.fn((url: string) => {
      if (url === '/api/matches') return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([matchT]) });
      return Promise.reject(new Error(url));
    });
    vi.stubGlobal('fetch', guestFetch);

    const guestRender = render(<Lobby user={null} />);
    fireEvent.click(await guestRender.findByRole('button', { name: 'Xem chi tiết' }));
    expect(await guestRender.findByText('Đăng nhập để vào trận')).toBeTruthy();
    expect(guestFetch).not.toHaveBeenCalledWith(`/api/matches/${m1.id}`, expect.anything());
  });

  it('AC-12: re-fetches lobby when SSE match event arrives, and closes EventSource on unmount', async () => {
    let matchListener: ((e: MessageEvent) => void) | null = null;
    const closeMock = vi.fn();

    class MockEventSource {
      constructor(public url: string) {}
      addEventListener(type: string, listener: (e: MessageEvent) => void) {
        if (type === 'match') matchListener = listener;
      }
      close() {
        closeMock();
      }
    }
    vi.stubGlobal('EventSource', MockEventSource);

    const fetch = vi.fn((url: string) => {
      const body = url === '/api/matches?sport=BADMINTON' ? [m1] : [];
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
    });
    vi.stubGlobal('fetch', fetch);

    const { unmount } = render(<Lobby />);
    fireEvent.change(await screen.findByLabelText(/^Môn thể thao/), { target: { value: 'BADMINTON' } });

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/matches?sport=BADMINTON', expect.anything()));
    fetch.mockClear();

    // Trigger SSE event.
    expect(matchListener).not.toBeNull();
    matchListener!({ data: JSON.stringify({ id: m1.id }) } as MessageEvent);

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith('/api/matches?sport=BADMINTON', expect.anything());

    unmount();
    expect(closeMock).toHaveBeenCalledTimes(1);
  });
});
