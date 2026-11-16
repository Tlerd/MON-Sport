import type { MatchDetailView, SessionUser } from '@monsport/shared';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
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
    vi.useRealTimers();
  });

  it('AC-16: renders matches with venue, court, time, sport, slots, price, host, and booking status badge, and filters by sport and date', async () => {
    vi.setSystemTime(new Date('2026-11-20T08:00:00+07:00'));
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
    expect(within(items[0]).getByRole('img', { name: '3/10 suất' })).toBeTruthy();
    expect(within(items[0]).getByText((_, el) => el?.classList.contains('fee') === true && el.textContent === '60k/suất')).toBeTruthy();
    expect(within(items[0]).getByText('Host: Chi')).toBeTruthy();
    expect(within(items[0]).getByText('Đã xác nhận')).toBeTruthy();

    expect(within(items[1]).getByText('Cầu lông · Ngày 20/11/2026')).toBeTruthy();
    expect(within(items[1]).getByRole('img', { name: '1/4 suất' })).toBeTruthy();
    expect(within(items[1]).getByText((_, el) => el?.classList.contains('fee') === true && el.textContent === '50k/suất')).toBeTruthy();
    expect(within(items[1]).getByText('Host: An')).toBeTruthy();
    expect(within(items[1]).getByText('Chưa xác nhận')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Cầu lông' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Ngày' }), { target: { value: '2026-11-20' } });

    await vi.waitFor(() =>
      expect(fetch).toHaveBeenCalledWith('/api/matches?sport=BADMINTON&date=2026-11-20', expect.anything()),
    );
    await vi.waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1));

    fireEvent.change(screen.getByRole('combobox', { name: 'Ngày' }), { target: { value: '2026-11-21' } });
    expect((await screen.findByRole('status')).textContent).toContain('Chưa có trận nào đang mở');
  });

  it('AC-3: one toolbar row holds the type switch, the level select, and the day select, and the sport chips sit in their own row', async () => {
    const fetch = vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([m1]) }));
    vi.stubGlobal('fetch', fetch);

    const { container } = render(<Lobby />);
    await screen.findByText('Cầu lông A · Sân 1');

    const bars = container.querySelectorAll('.fbar');
    expect(bars).toHaveLength(1);
    const bar = bars[0] as HTMLElement;
    expect(within(bar).getByRole('group', { name: 'Loại trận' })).toBeTruthy();
    expect(within(bar).getByRole('combobox', { name: 'Trình độ' })).toBeTruthy();
    expect(within(bar).getByRole('combobox', { name: 'Ngày' })).toBeTruthy();
    expect(bar.querySelector('.count')?.textContent).toBe('1 trận đang mở');

    const sportRow = screen.getByRole('group', { name: 'Môn thể thao' });
    expect(bar.contains(sportRow)).toBe(false);
    expect(Boolean(bar.compareDocumentPosition(sportRow) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(container.querySelector('.filter-label')).toBeNull();
    expect(container.querySelectorAll('.filter-chips-row .chips')).toHaveLength(1);
  });

  it('AC-5: the detail panel shows the hero, the facts row, the players progress bar, and the player grid', async () => {
    const chiUser: SessionUser = { id: '0199a1b2-0000-7000-8000-000000000102', name: 'Chi', role: 'USER' };
    const detail: MatchDetailView = {
      ...m1,
      joinedCount: 2,
      viewerRole: 'NONE',
      players: [
        { userId: m1.hostId, name: 'An', phone: null, joinedAt: '2026-11-20T03:00:00.000Z' },
        { userId: '0199a1b2-0000-7000-8000-000000000103', name: 'Em', phone: null, joinedAt: '2026-11-20T03:01:00.000Z' },
      ],
    };
    const fetch = vi.fn((url: string) => {
      const body = url === `/api/matches/${m1.id}` ? detail : [m1];
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
    });
    vi.stubGlobal('fetch', fetch);

    const { container } = render(<Lobby user={chiUser} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Xem chi tiết' }));

    const panel = container.querySelector('.lobby-detail-pane .detail') as HTMLElement;
    expect(panel.querySelector('header.hero svg.court')).toBeTruthy();
    expect(panel.querySelector('.hero-when b')?.textContent).toBe('20:00');
    expect(panel.querySelectorAll('dl.facts > div')).toHaveLength(4);
    await vi.waitFor(() => expect(panel.querySelector('.players-section .meter i')).toBeTruthy());
    expect((panel.querySelector('.meter i') as HTMLElement).style.width).toBe('50%');
    expect(panel.querySelectorAll('.roster .rp')).toHaveLength(2);
    expect(panel.querySelector('.detail-f .btn.lime')?.textContent).toBe('Vào trận');
  });

  it('clicking "Bóng đá" requests the lobby with the football filter', async () => {
    const fetch = vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([m2]) }));
    vi.stubGlobal('fetch', fetch);

    render(<Lobby />);
    const footballChip = await screen.findByRole('button', { name: 'Bóng đá' });
    fireEvent.click(footballChip);

    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/matches?sport=FOOTBALL', expect.anything());
    });
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
    const playersSection = document.querySelector('.players-section') as HTMLElement;
    expect(within(playersSection).getByText('An')).toBeTruthy();
    expect(within(playersSection).getByText('Em')).toBeTruthy();

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
    fireEvent.click(await screen.findByRole('button', { name: 'Cầu lông' }));

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

  it('renders filter chip row above the columns across full width and outside the list pane', async () => {
    const fetch = vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) }));
    vi.stubGlobal('fetch', fetch);

    const { container } = render(<Lobby />);
    const filterRow = container.querySelector('.filter-chips-row');
    const lobbySplit = container.querySelector('.lobby-split');
    const listPane = container.querySelector('.lobby-list-pane');

    expect(filterRow).toBeTruthy();
    expect(lobbySplit).toBeTruthy();
    expect(listPane).toBeTruthy();

    expect(Boolean(filterRow!.compareDocumentPosition(lobbySplit!) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(listPane!.contains(filterRow)).toBe(false);
  });

  it('places lobby-detail-pane after lobby-list-pane in the DOM order for mobile column stacking', async () => {
    const fetch = vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([m1]) }));
    vi.stubGlobal('fetch', fetch);

    const { container } = render(<Lobby />);
    const lobbySplit = container.querySelector('.lobby-split');
    const listPane = container.querySelector('.lobby-list-pane');
    const detailPane = container.querySelector('.lobby-detail-pane');

    expect(lobbySplit).toBeTruthy();
    expect(listPane).toBeTruthy();
    expect(detailPane).toBeTruthy();
    expect(lobbySplit!.children[0]).toBe(listPane);
    expect(lobbySplit!.children[1]).toBe(detailPane);
  });

  it('AC-6: price "50.000" with "/suất", label "Chưa xác nhận", and "Đầy" next to it for 4/4', async () => {
    const fullMatch = {
      ...m1,
      id: '0199a1b2-0000-7000-8000-000000000399',
      capacity: 4,
      joinedCount: 4,
      status: 'FULL' as const,
      bookingStatus: 'PENDING' as const,
      pricePerSlot: 50_000,
    };
    const fetch = vi.fn((url: string) => {
      if (url === '/api/matches') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([fullMatch]) });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });
    vi.stubGlobal('fetch', fetch);

    render(<Lobby />);
    const card = await screen.findByRole('listitem');
    expect(within(card).getByText((_, el) => el?.classList.contains('fee') === true && el.textContent === '50k/suất')).toBeTruthy();
    expect(within(card).getByText('Chưa xác nhận')).toBeTruthy();
    expect(within(card).getByText('Đầy')).toBeTruthy();
  });

  it('AC-7: filter chip row is before the list and before the detail pane in DOM order: use compareDocumentPosition', async () => {
    const fetch = vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([m1]) }));
    vi.stubGlobal('fetch', fetch);

    const { container } = render(<Lobby />);
    const filterRow = container.querySelector('.filter-chips-row');
    const listPane = container.querySelector('.lobby-list-pane');
    const detailPane = container.querySelector('.lobby-detail-pane');

    expect(filterRow).toBeTruthy();
    expect(listPane).toBeTruthy();
    expect(detailPane).toBeTruthy();

    expect(Boolean(filterRow!.compareDocumentPosition(listPane!) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(Boolean(filterRow!.compareDocumentPosition(detailPane!) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });

  it('AC-12: shows "Host duyệt" badge on APPROVAL match, lets player request and cancel request, and shows rejected state without join button', async () => {
    const lanUser: SessionUser = { id: '0199a1b2-0000-7000-8000-000000000105', name: 'Lan', role: 'USER' };
    const mInstant = { ...m1, joinMode: 'INSTANT' as const };
    const mApproval = {
      ...m2,
      joinMode: 'APPROVAL' as const,
      capacity: 4,
      joinedCount: 1,
    };

    const detailInstant: MatchDetailView = {
      ...mInstant,
      viewerRole: 'NONE',
      players: [{ userId: mInstant.hostId, name: mInstant.hostName, phone: null, joinedAt: '2026-11-20T03:00:00.000Z' }],
      myRequest: null,
    };

    let currentApprovalDetail: MatchDetailView = {
      ...mApproval,
      viewerRole: 'NONE',
      players: [{ userId: mApproval.hostId, name: mApproval.hostName, phone: null, joinedAt: '2026-11-20T03:00:00.000Z' }],
      myRequest: null,
    };

    const fetch = vi.fn((url: string, options?: RequestInit) => {
      if (url === '/api/matches') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([mInstant, mApproval]) });
      }
      if (url === `/api/matches/${mInstant.id}`) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(detailInstant) });
      }
      if (url === `/api/matches/${mApproval.id}`) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(currentApprovalDetail) });
      }
      if (url === `/api/matches/${mApproval.id}/join` && options?.method === 'POST') {
        currentApprovalDetail = { ...currentApprovalDetail, myRequest: 'PENDING' };
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(currentApprovalDetail) });
      }
      if (url === `/api/matches/${mApproval.id}/leave` && options?.method === 'POST') {
        currentApprovalDetail = { ...currentApprovalDetail, myRequest: null };
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(currentApprovalDetail) });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });
    vi.stubGlobal('fetch', fetch);

    render(<Lobby user={lanUser} />);
    expect(await screen.findByText('Cầu lông A · Sân 1')).toBeTruthy();
    expect(screen.getByText('Cầu lông A · Sân 2')).toBeTruthy();

    const tickets = screen.getAllByRole('listitem');
    expect(within(tickets[0]).queryByText('Host duyệt')).toBeNull();
    expect(within(tickets[1]).getByText('Host duyệt')).toBeTruthy();

    // Open INSTANT match detail -> keeps "Vào trận"
    fireEvent.click(within(tickets[0]).getByRole('button', { name: 'Xem chi tiết' }));
    expect(await screen.findByRole('button', { name: 'Vào trận' })).toBeTruthy();

    // Open APPROVAL match detail -> shows "Xin vào" and not "Vào trận"
    fireEvent.click(within(tickets[1]).getByRole('button', { name: 'Xem chi tiết' }));
    expect(await screen.findByRole('button', { name: 'Xin vào' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Vào trận' })).toBeNull();

    // Click "Xin vào" -> calls POST /api/matches/:id/join, shows pending status and "Hủy yêu cầu"
    fireEvent.click(screen.getByRole('button', { name: 'Xin vào' }));
    await vi.waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(`/api/matches/${mApproval.id}/join`, expect.objectContaining({ method: 'POST' })),
    );
    expect(await screen.findByText('Đã gửi yêu cầu. Chờ host duyệt')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hủy yêu cầu' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Xin vào' })).toBeNull();

    // Click "Hủy yêu cầu" -> calls POST /api/matches/:id/leave, brings "Xin vào" back
    fireEvent.click(screen.getByRole('button', { name: 'Hủy yêu cầu' }));
    await vi.waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(`/api/matches/${mApproval.id}/leave`, expect.objectContaining({ method: 'POST' })),
    );
    expect(await screen.findByRole('button', { name: 'Xin vào' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Hủy yêu cầu' })).toBeNull();

    // Re-open when myRequest is REJECTED -> shows rejected text and no join button
    currentApprovalDetail = { ...currentApprovalDetail, myRequest: 'REJECTED' };
    fireEvent.click(within(tickets[1]).getByRole('button', { name: 'Đóng chi tiết' }));
    fireEvent.click(within(tickets[1]).getByRole('button', { name: 'Xem chi tiết' }));
    expect(await screen.findByText('Host đã từ chối yêu cầu của bạn')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Xin vào' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Vào trận' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Hủy yêu cầu' })).toBeNull();
    expect(fetch).not.toHaveBeenCalledWith(expect.stringContaining('/requests'), expect.anything());
  });

  it('AC-12: an SSE match event as a guest triggers no GET /api/matches/<id> and no /requests call', async () => {
    let matchListener: ((e: MessageEvent) => void) | null = null;
    class MockEventSource {
      constructor(public url: string) {}
      addEventListener(type: string, listener: (e: MessageEvent) => void) {
        if (type === 'match') matchListener = listener;
      }
      close() {}
    }
    vi.stubGlobal('EventSource', MockEventSource);

    const mApproval = { ...m1, joinMode: 'APPROVAL' as const };
    const fetch = vi.fn((url: string) => {
      if (url === '/api/matches') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([mApproval]) });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });
    vi.stubGlobal('fetch', fetch);

    render(<Lobby user={null} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Xem chi tiết' }));
    expect(await screen.findByText('Đăng nhập để vào trận')).toBeTruthy();

    fetch.mockClear();
    expect(matchListener).not.toBeNull();
    matchListener!({ data: JSON.stringify({ id: mApproval.id }) } as MessageEvent);

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/matches', expect.anything()));
    expect(fetch).not.toHaveBeenCalledWith(`/api/matches/${mApproval.id}`, expect.anything());
    expect(fetch).not.toHaveBeenCalledWith(expect.stringContaining('/requests'), expect.anything());
  });

  it('AC-13: host sees pending queue, reloads on SSE match event, approves and rejects requests, and shows 409 alert on full match', async () => {
    const hostUser: SessionUser = { id: m1.hostId, name: 'An', role: 'USER' };
    const lanId = '0199a1b2-0000-7000-8000-000000000105';
    const minhId = '0199a1b2-0000-7000-8000-000000000106';

    let matchListener: ((e: MessageEvent) => void) | null = null;
    class MockEventSource {
      constructor(public url: string) {}
      addEventListener(type: string, listener: (e: MessageEvent) => void) {
        if (type === 'match') matchListener = listener;
      }
      close() {}
    }
    vi.stubGlobal('EventSource', MockEventSource);

    const mApproval = { ...m1, joinMode: 'APPROVAL' as const, capacity: 4, joinedCount: 1 };
    let currentDetail: MatchDetailView = {
      ...mApproval,
      viewerRole: 'HOST',
      pendingCount: 1,
      players: [{ userId: m1.hostId, name: 'An', phone: '0901234567', joinedAt: '2026-11-20T03:00:00.000Z' }],
    };
    let currentRequests = [
      { userId: lanId, name: 'Lan', phone: '0901234568', requestedAt: '2026-11-20T03:05:00.000Z' },
    ];
    let failApprove = false;

    const fetch = vi.fn((url: string, options?: RequestInit) => {
      if (url === '/api/matches') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([mApproval]) });
      }
      if (url === `/api/matches/${mApproval.id}`) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(currentDetail) });
      }
      if (url === `/api/matches/${mApproval.id}/requests`) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(currentRequests) });
      }
      if (url === `/api/matches/${mApproval.id}/requests/${lanId}/approve` && options?.method === 'POST') {
        if (failApprove) {
          return Promise.resolve({ ok: false, status: 409, json: () => Promise.resolve({ message: 'Trận đã đủ người' }) });
        }
        currentDetail = {
          ...currentDetail,
          joinedCount: 2,
          pendingCount: 1,
          players: [
            ...currentDetail.players,
            { userId: lanId, name: 'Lan', phone: '0901234568', joinedAt: '2026-11-20T03:10:00.000Z' },
          ],
        };
        currentRequests = currentRequests.filter((r) => r.userId !== lanId);
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(currentDetail) });
      }
      if (url === `/api/matches/${mApproval.id}/requests/${minhId}/reject` && options?.method === 'POST') {
        currentDetail = { ...currentDetail, pendingCount: 0 };
        currentRequests = currentRequests.filter((r) => r.userId !== minhId);
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(currentDetail) });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });
    vi.stubGlobal('fetch', fetch);

    render(<Lobby user={hostUser} />);
    expect(await screen.findByText('Cầu lông A · Sân 1')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Xem chi tiết' }));
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledWith(`/api/matches/${mApproval.id}/requests`, expect.anything()));

    expect(await screen.findByText('Hàng chờ (1)')).toBeTruthy();
    expect(screen.getByText('Lan')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Duyệt' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Từ chối' })).toBeTruthy();

    // SSE match event arrives -> reloads detail and requests (now 2 entries)
    currentDetail = { ...currentDetail, pendingCount: 2 };
    currentRequests = [
      { userId: lanId, name: 'Lan', phone: '0901234568', requestedAt: '2026-11-20T03:05:00.000Z' },
      { userId: minhId, name: 'Minh', phone: '0901234569', requestedAt: '2026-11-20T03:06:00.000Z' },
    ];
    expect(matchListener).not.toBeNull();
    matchListener!({ data: JSON.stringify({ id: mApproval.id }) } as MessageEvent);

    expect(await screen.findByText('Hàng chờ (2)')).toBeTruthy();
    expect(screen.getByText('Minh')).toBeTruthy();

    // Approve fails with 409 "Trận đã đủ người" -> shows alert and keeps the row
    failApprove = true;
    const approveButtonsBefore = screen.getAllByRole('button', { name: 'Duyệt' });
    fireEvent.click(approveButtonsBefore[0]);
    expect((await screen.findByRole('alert')).textContent).toContain('Trận đã đủ người');
    expect(screen.getByText('Hàng chờ (2)')).toBeTruthy();
    expect(screen.getByText('Lan')).toBeTruthy();

    // Approve succeeds -> Lan moves to "Người tham gia" and queue count drops to 1
    failApprove = false;
    fireEvent.click(screen.getAllByRole('button', { name: 'Duyệt' })[0]);
    await vi.waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        `/api/matches/${mApproval.id}/requests/${lanId}/approve`,
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    expect(await screen.findByText('Hàng chờ (1)')).toBeTruthy();
    const playersSection = screen.getByText('Người tham gia:').closest('.players-section')!;
    expect(within(playersSection as HTMLElement).getByText(/Lan/)).toBeTruthy();

    // Clicking "Từ chối" on Minh calls .../reject and queue becomes empty
    fireEvent.click(screen.getByRole('button', { name: 'Từ chối' }));
    await vi.waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        `/api/matches/${mApproval.id}/requests/${minhId}/reject`,
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    expect(await screen.findByText('Hàng chờ (0)')).toBeTruthy();
    expect(screen.getByText('Chưa có yêu cầu')).toBeTruthy();
  });

  it("AC-13: when the host opens match A then match B and A's detail and requests resolve last, B's panel shows B's queue and not A's requesters", async () => {
    function deferred<T>() {
      let resolve!: (value: T) => void;
      const promise = new Promise<T>((res) => {
        resolve = res;
      });
      return { promise, resolve };
    }

    const hostUser: SessionUser = { id: m1.hostId, name: 'An', role: 'USER' };
    const lanId = '0199a1b2-0000-7000-8000-000000000105';
    const minhId = '0199a1b2-0000-7000-8000-000000000106';

    const mA = { ...m1, joinMode: 'APPROVAL' as const, capacity: 4, joinedCount: 1 };
    const mB = { ...m2, hostId: m1.hostId, hostName: 'An', joinMode: 'APPROVAL' as const, capacity: 4, joinedCount: 1 };

    const detailA: MatchDetailView = {
      ...mA,
      viewerRole: 'HOST',
      pendingCount: 1,
      players: [{ userId: m1.hostId, name: 'An', phone: '0901234567', joinedAt: '2026-11-20T03:00:00.000Z' }],
    };
    const detailB: MatchDetailView = {
      ...mB,
      viewerRole: 'HOST',
      pendingCount: 1,
      players: [{ userId: m1.hostId, name: 'An', phone: '0901234567', joinedAt: '2026-11-20T03:00:00.000Z' }],
    };
    const requestsA = [{ userId: lanId, name: 'Lan', phone: '0901234568', requestedAt: '2026-11-20T03:05:00.000Z' }];
    const requestsB = [{ userId: minhId, name: 'Minh', phone: '0901234569', requestedAt: '2026-11-20T03:06:00.000Z' }];

    const detailADeferred = deferred<MatchDetailView>();
    const requestsADeferred = deferred<typeof requestsA>();
    let currentRequestsADeferred = requestsADeferred;
    let aDetailMode: 'deferred' | 'immediate' = 'deferred';

    const fetch = vi.fn((url: string) => {
      if (url === '/api/matches') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([mA, mB]) });
      }
      if (url === `/api/matches/${mA.id}`) {
        if (aDetailMode === 'deferred') {
          return detailADeferred.promise.then((body) => ({ ok: true, status: 200, json: () => Promise.resolve(body) }));
        }
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(detailA) });
      }
      if (url === `/api/matches/${mA.id}/requests`) {
        return currentRequestsADeferred.promise.then((body) => ({ ok: true, status: 200, json: () => Promise.resolve(body) }));
      }
      if (url === `/api/matches/${mB.id}`) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(detailB) });
      }
      if (url === `/api/matches/${mB.id}/requests`) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(requestsB) });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });
    vi.stubGlobal('fetch', fetch);

    render(<Lobby user={hostUser} />);
    expect(await screen.findByText('Cầu lông A · Sân 1')).toBeTruthy();

    const tickets = screen.getAllByRole('listitem');
    // Host opens A (where detailA is slow), then opens B.
    fireEvent.click(within(tickets[0]).getByRole('button', { name: 'Xem chi tiết' }));
    fireEvent.click(within(tickets[1]).getByRole('button', { name: 'Xem chi tiết' }));

    expect(await screen.findByText('Hàng chờ (1)')).toBeTruthy();
    expect(screen.getByText('Minh')).toBeTruthy();

    // Now A's detail and requests resolve last.
    await act(async () => {
      detailADeferred.resolve(detailA);
      requestsADeferred.resolve(requestsA);
    });

    expect(screen.getByText('Hàng chờ (1)')).toBeTruthy();
    expect(screen.getByText('Minh')).toBeTruthy();
    expect(screen.queryByText('Lan')).toBeNull();

    // Also test when A's detail resolves while A is open, A's /requests is slow, host opens B, and A's /requests resolves last.
    const requestsA2Deferred = deferred<typeof requestsA>();
    currentRequestsADeferred = requestsA2Deferred;
    aDetailMode = 'immediate';

    fireEvent.click(within(tickets[0]).getByRole('button', { name: 'Xem chi tiết' }));
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledWith(`/api/matches/${mA.id}/requests`, expect.anything()));

    fireEvent.click(within(tickets[1]).getByRole('button', { name: 'Xem chi tiết' }));
    expect(await screen.findByText('Minh')).toBeTruthy();

    await act(async () => {
      requestsA2Deferred.resolve(requestsA);
    });

    expect(screen.getByText('Hàng chờ (1)')).toBeTruthy();
    expect(screen.getByText('Minh')).toBeTruthy();
    expect(screen.queryByText('Lan')).toBeNull();
  });

  it('AC-13: when an SSE reload is slow and the host approves Lan, the old reload resolving last does not put Lan back in Hàng chờ', async () => {
    function deferred<T>() {
      let resolve!: (value: T) => void;
      const promise = new Promise<T>((res) => {
        resolve = res;
      });
      return { promise, resolve };
    }

    let matchListener: ((e: MessageEvent) => void) | null = null;
    class MockEventSource {
      constructor(public url: string) {}
      addEventListener(type: string, listener: (e: MessageEvent) => void) {
        if (type === 'match') matchListener = listener;
      }
      close() {}
    }
    vi.stubGlobal('EventSource', MockEventSource);

    const hostUser: SessionUser = { id: m1.hostId, name: 'An', role: 'USER' };
    const lanId = '0199a1b2-0000-7000-8000-000000000105';
    const mApproval = { ...m1, joinMode: 'APPROVAL' as const, capacity: 4, joinedCount: 1 };

    const detailBeforeApprove: MatchDetailView = {
      ...mApproval,
      viewerRole: 'HOST',
      pendingCount: 1,
      players: [{ userId: m1.hostId, name: 'An', phone: '0901234567', joinedAt: '2026-11-20T03:00:00.000Z' }],
    };
    const detailAfterApprove: MatchDetailView = {
      ...mApproval,
      joinedCount: 2,
      viewerRole: 'HOST',
      pendingCount: 0,
      players: [
        { userId: m1.hostId, name: 'An', phone: '0901234567', joinedAt: '2026-11-20T03:00:00.000Z' },
        { userId: lanId, name: 'Lan', phone: '0901234568', joinedAt: '2026-11-20T03:10:00.000Z' },
      ],
    };
    const requestsWithLan = [
      { userId: lanId, name: 'Lan', phone: '0901234568', requestedAt: '2026-11-20T03:05:00.000Z' },
    ];

    const slowSseRequests = deferred<typeof requestsWithLan>();
    let requestsCallCount = 0;
    let failNextDetail = false;

    const fetch = vi.fn((url: string, options?: RequestInit) => {
      if (url === '/api/matches') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([mApproval]) });
      }
      if (url === `/api/matches/${mApproval.id}`) {
        if (failNextDetail) {
          failNextDetail = false;
          return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({ message: 'Lỗi mạng tạm thời' }) });
        }
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(detailBeforeApprove) });
      }
      if (url === `/api/matches/${mApproval.id}/requests`) {
        requestsCallCount++;
        // Call 1: initial open. Call 2: slow SSE reload. Call 3: post-approve reload.
        if (requestsCallCount === 1) {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(requestsWithLan) });
        }
        if (requestsCallCount === 2) {
          return slowSseRequests.promise.then((body) => ({ ok: true, status: 200, json: () => Promise.resolve(body) }));
        }
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
      }
      if (url === `/api/matches/${mApproval.id}/requests/${lanId}/approve` && options?.method === 'POST') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(detailAfterApprove) });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });
    vi.stubGlobal('fetch', fetch);

    render(<Lobby user={hostUser} />);
    expect(await screen.findByText('Cầu lông A · Sân 1')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Xem chi tiết' }));
    expect(await screen.findByText('Hàng chờ (1)')).toBeTruthy();
    expect(screen.getByText('Lan')).toBeTruthy();

    // A failed reload sets detailError, and a later success clears it.
    failNextDetail = true;
    matchListener!({ data: JSON.stringify({ id: mApproval.id }) } as MessageEvent);
    expect((await screen.findByRole('alert')).textContent).toContain('Lỗi mạng tạm thời');

    // Now trigger the slow SSE reload (requestsCallCount === 2).
    matchListener!({ data: JSON.stringify({ id: mApproval.id }) } as MessageEvent);
    await vi.waitFor(() => expect(requestsCallCount).toBe(2));

    // Host approves Lan while the SSE reload is still in flight.
    fireEvent.click(screen.getByRole('button', { name: 'Duyệt' }));
    expect(await screen.findByText('Hàng chờ (0)')).toBeTruthy();
    expect(screen.getByText('Chưa có yêu cầu')).toBeTruthy();

    // Now the older SSE GET /requests resolves last with Lan still in the list.
    await act(async () => {
      slowSseRequests.resolve(requestsWithLan);
    });

    expect(screen.getByText('Hàng chờ (0)')).toBeTruthy();
    expect(screen.getByText('Chưa có yêu cầu')).toBeTruthy();
    const queueSection = screen.getByText('Hàng chờ (0)').closest('.queue-section')!;
    expect(within(queueSection as HTMLElement).queryByText('Lan')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('AC-13: with two rows and two clicks, when the first call ends first the second row buttons stay disabled until its own call ends', async () => {
    function deferred<T>() {
      let resolve!: (value: T) => void;
      const promise = new Promise<T>((res) => {
        resolve = res;
      });
      return { promise, resolve };
    }

    const hostUser: SessionUser = { id: m1.hostId, name: 'An', role: 'USER' };
    const lanId = '0199a1b2-0000-7000-8000-000000000105';
    const minhId = '0199a1b2-0000-7000-8000-000000000106';
    const mApproval = { ...m1, joinMode: 'APPROVAL' as const, capacity: 4, joinedCount: 1 };

    let currentDetail: MatchDetailView = {
      ...mApproval,
      viewerRole: 'HOST',
      pendingCount: 2,
      players: [{ userId: m1.hostId, name: 'An', phone: '0901234567', joinedAt: '2026-11-20T03:00:00.000Z' }],
    };
    const initialRequests = [
      { userId: lanId, name: 'Lan', phone: '0901234568', requestedAt: '2026-11-20T03:05:00.000Z' },
      { userId: minhId, name: 'Minh', phone: '0901234569', requestedAt: '2026-11-20T03:06:00.000Z' },
    ];

    const approveLanDeferred = deferred<MatchDetailView>();
    const rejectMinhDeferred = deferred<MatchDetailView>();
    let requestsCalls = 0;

    const fetch = vi.fn((url: string, options?: RequestInit) => {
      if (url === '/api/matches') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([mApproval]) });
      }
      if (url === `/api/matches/${mApproval.id}`) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(currentDetail) });
      }
      if (url === `/api/matches/${mApproval.id}/requests`) {
        requestsCalls++;
        if (requestsCalls === 1) {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(initialRequests) });
        }
        if (requestsCalls === 2) {
          // After Lan is approved, Minh is still in the queue.
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([initialRequests[1]]) });
        }
        // After Minh is rejected, simulate reload failure to also verify local row removal without decision alert.
        return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({ message: 'Reload failed' }) });
      }
      if (url === `/api/matches/${mApproval.id}/requests/${lanId}/approve` && options?.method === 'POST') {
        return approveLanDeferred.promise.then((body) => ({ ok: true, status: 200, json: () => Promise.resolve(body) }));
      }
      if (url === `/api/matches/${mApproval.id}/requests/${minhId}/reject` && options?.method === 'POST') {
        return rejectMinhDeferred.promise.then((body) => ({ ok: true, status: 200, json: () => Promise.resolve(body) }));
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });
    vi.stubGlobal('fetch', fetch);

    render(<Lobby user={hostUser} />);
    expect(await screen.findByText('Cầu lông A · Sân 1')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Xem chi tiết' }));
    expect(await screen.findByText('Hàng chờ (2)')).toBeTruthy();

    const approveBtns = screen.getAllByRole('button', { name: 'Duyệt' }) as HTMLButtonElement[];
    const rejectBtns = screen.getAllByRole('button', { name: 'Từ chối' }) as HTMLButtonElement[];

    // Click "Duyệt" on Lan (row 0), then "Từ chối" on Minh (row 1).
    fireEvent.click(approveBtns[0]);
    fireEvent.click(rejectBtns[1]);

    expect(approveBtns[0].disabled).toBe(true);
    expect(rejectBtns[0].disabled).toBe(true);
    expect(approveBtns[1].disabled).toBe(true);
    expect(rejectBtns[1].disabled).toBe(true);

    // Lan's call ends first.
    currentDetail = {
      ...currentDetail,
      joinedCount: 2,
      pendingCount: 1,
      players: [
        ...currentDetail.players,
        { userId: lanId, name: 'Lan', phone: '0901234568', joinedAt: '2026-11-20T03:10:00.000Z' },
      ],
    };
    approveLanDeferred.resolve(currentDetail);
    expect(await screen.findByText('Hàng chờ (1)')).toBeTruthy();

    // Minh's buttons must stay disabled while Minh's call is still running.
    const minhApproveBtn = screen.getByRole('button', { name: 'Duyệt' }) as HTMLButtonElement;
    const minhRejectBtn = screen.getByRole('button', { name: 'Từ chối' }) as HTMLButtonElement;
    expect(minhApproveBtn.disabled).toBe(true);
    expect(minhRejectBtn.disabled).toBe(true);

    // Now Minh's call ends (and its subsequent /requests reload fails).
    currentDetail = { ...currentDetail, pendingCount: 0 };
    rejectMinhDeferred.resolve(currentDetail);
    expect(await screen.findByText('Hàng chờ (0)')).toBeTruthy();
    expect(screen.getByText('Chưa có yêu cầu')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('AC-8: the "Trình độ" select shows "Mọi trình độ" selected and the first request has no level; choosing "Khá" requests /api/matches?level=ADVANCED; after a stream event the reload URL still has level=ADVANCED', async () => {
    let matchListener: ((e: MessageEvent) => void) | null = null;
    class MockEventSource {
      constructor(public url: string) {}
      addEventListener(type: string, listener: (e: MessageEvent) => void) {
        if (type === 'match') matchListener = listener;
      }
      close() {}
    }
    vi.stubGlobal('EventSource', MockEventSource);

    const fetch = vi.fn((url: string) => {
      const body = url === '/api/matches?level=ADVANCED' ? [m1] : [];
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
    });
    vi.stubGlobal('fetch', fetch);

    const { unmount } = render(<Lobby />);
    const levelSelect = screen.getByRole('combobox', { name: 'Trình độ' }) as HTMLSelectElement;
    expect(levelSelect.value).toBe('');
    expect(within(levelSelect).getByRole('option', { name: 'Mọi trình độ' })).toBeTruthy();

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/matches', expect.anything()));
    fetch.mockClear();

    fireEvent.change(levelSelect, { target: { value: 'ADVANCED' } });

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/matches?level=ADVANCED', expect.anything()));
    fetch.mockClear();

    // Trigger SSE event.
    expect(matchListener).not.toBeNull();
    matchListener!({ data: JSON.stringify({ id: m1.id }) } as MessageEvent);

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/matches?level=ADVANCED', expect.anything()));
    unmount();
  });

  it('AC-9: each match card in lobby displays host skill level label or none when null', async () => {
    const withLevel = { ...m1, hostSkillLevel: 'INTERMEDIATE' as const };
    const withoutLevel = { ...m2, hostSkillLevel: null };
    const fetch = vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([withLevel, withoutLevel]) }));
    vi.stubGlobal('fetch', fetch);

    render(<Lobby />);
    expect(await screen.findByText('Cầu lông A · Sân 1')).toBeTruthy();
    expect(screen.getByText('Cầu lông A · Sân 2')).toBeTruthy();

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText('Trình độ: Trung bình')).toBeTruthy();
    expect(within(items[1]).queryByText('Trình độ: Trung bình')).toBeNull();
    expect(within(items[1]).queryByText('Mới chơi')).toBeNull();
    expect(within(items[1]).queryByText('Trung bình')).toBeNull();
    expect(within(items[1]).queryByText('Khá')).toBeNull();
  });

  it('AC-9: in host queue, each requester shows reputation: "4,5 ★ (12) · 1 lần vắng", omits no-show count when 0, shows "Chưa có đánh giá" when unrated, and "Chưa có sao · 2 lần vắng" when only no-shows exist', async () => {
    const hostUser: SessionUser = { id: m1.hostId, name: 'An', role: 'USER' };
    const mApproval = { ...m1, joinMode: 'APPROVAL' as const, capacity: 6, joinedCount: 1 };
    const detailView: MatchDetailView = {
      ...mApproval,
      viewerRole: 'HOST',
      pendingCount: 5,
      players: [{ userId: m1.hostId, name: 'An', phone: '0901234567', joinedAt: '2026-11-20T03:00:00.000Z' }],
    };

    const requests = [
      {
        userId: '0199a1b2-0000-7000-8000-000000000105',
        name: 'Lan',
        phone: '0901234568',
        requestedAt: '2026-11-20T03:05:00.000Z',
        reputation: { ratingAvg: 4.5, ratingCount: 12, noShowCount: 1 },
      },
      {
        userId: '0199a1b2-0000-7000-8000-000000000106',
        name: 'Minh',
        phone: '0901234569',
        requestedAt: '2026-11-20T03:06:00.000Z',
        reputation: { ratingAvg: 5, ratingCount: 3, noShowCount: 0 },
      },
      {
        userId: '0199a1b2-0000-7000-8000-000000000107',
        name: 'Nam',
        phone: '0901234570',
        requestedAt: '2026-11-20T03:07:00.000Z',
        reputation: { ratingAvg: null, ratingCount: 0, noShowCount: 0 },
      },
      {
        userId: '0199a1b2-0000-7000-8000-000000000108',
        name: 'Oanh',
        phone: '0901234571',
        requestedAt: '2026-11-20T03:08:00.000Z',
        reputation: { ratingAvg: null, ratingCount: 0, noShowCount: 2 },
      },
      {
        userId: '0199a1b2-0000-7000-8000-000000000109',
        name: 'Phúc',
        phone: '0901234572',
        requestedAt: '2026-11-20T03:09:00.000Z',
      },
    ];

    const fetch = vi.fn((url: string) => {
      if (url === '/api/matches') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([mApproval]) });
      }
      if (url === `/api/matches/${mApproval.id}`) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(detailView) });
      }
      if (url === `/api/matches/${mApproval.id}/requests`) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(requests) });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });
    vi.stubGlobal('fetch', fetch);

    render(<Lobby user={hostUser} />);
    expect(await screen.findByText('Cầu lông A · Sân 1')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Xem chi tiết' }));
    expect(await screen.findByText('Hàng chờ (5)')).toBeTruthy();

    const queueRows = screen.getAllByRole('listitem').filter((li) => li.classList.contains('queue-row'));
    expect(queueRows).toHaveLength(5);

    // 1. Lan: 4.5 avg, 12 ratings, 1 no-show -> '4,5 ★ (12) · 1 lần vắng'
    expect(within(queueRows[0]).getByText('Lan')).toBeTruthy();
    expect(within(queueRows[0]).getByText('4,5 ★ (12) · 1 lần vắng')).toBeTruthy();

    // 2. Minh: 5 avg, 3 ratings, 0 no-shows -> '5 ★ (3)' (omits · 0 lần vắng)
    expect(within(queueRows[1]).getByText('Minh')).toBeTruthy();
    expect(within(queueRows[1]).getByText('5 ★ (3)')).toBeTruthy();
    expect(within(queueRows[1]).queryByText(/lần vắng/)).toBeNull();

    // 3. Nam: unrated (null, 0, 0) -> 'Chưa có đánh giá' (never '0 ★')
    expect(within(queueRows[2]).getByText('Nam')).toBeTruthy();
    expect(within(queueRows[2]).getByText('Chưa có đánh giá')).toBeTruthy();
    expect(within(queueRows[2]).queryByText(/★/)).toBeNull();

    // 4. Oanh: only no-shows (null, 0, 2) -> 'Chưa có sao · 2 lần vắng' (never '0 ★')
    expect(within(queueRows[3]).getByText('Oanh')).toBeTruthy();
    expect(within(queueRows[3]).getByText('Chưa có sao · 2 lần vắng')).toBeTruthy();
    expect(within(queueRows[3]).queryByText(/★/)).toBeNull();

    // 5. Phúc: reputation is undefined -> 'Chưa có đánh giá'
    expect(within(queueRows[4]).getByText('Phúc')).toBeTruthy();
    expect(within(queueRows[4]).getByText('Chưa có đánh giá')).toBeTruthy();
    expect(within(queueRows[4]).queryByText(/★/)).toBeNull();
  });

  it('AC-6: opens detail for match B when loaded at /phong-cho?tran=<id of B>', async () => {
    const viewerUser: SessionUser = { id: '0199a1b2-0000-7000-8000-000000000199', name: 'Bình', role: 'USER' };
    const detailB: MatchDetailView = {
      ...m2,
      viewerRole: 'NONE',
      players: [
        { userId: m2.hostId, name: 'Chi', phone: null, joinedAt: '2026-11-20T03:00:00.000Z' },
      ],
    };

    const fetch = vi.fn((url: string) => {
      if (url === '/api/matches') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([m1, m2]) });
      }
      if (url === `/api/matches/${m2.id}`) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(detailB) });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });
    vi.stubGlobal('fetch', fetch);

    const { container } = render(
      <MemoryRouter initialEntries={[`/phong-cho?tran=${m2.id}`]}>
        <Routes>
          <Route path="/phong-cho" element={<Lobby user={viewerUser} />} />
        </Routes>
      </MemoryRouter>,
    );

    const detailPane = container.querySelector('.match-detail') ?? (await vi.waitFor(() => {
      const el = container.querySelector('.match-detail');
      if (!el) throw new Error('Detail not open yet');
      return el;
    }));
    expect(within(detailPane as HTMLElement).getByText('Cầu lông A · Sân 2')).toBeTruthy();
    expect(await within(detailPane as HTMLElement).findByText('Còn 7 suất trống')).toBeTruthy();
    expect(within(detailPane as HTMLElement).getByText('60.000đ/suất')).toBeTruthy();
  });
});
