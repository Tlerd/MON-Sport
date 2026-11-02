import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as clientModule from '@monsport/client';
import { ApiError, lobbyChips } from '@monsport/client';
import type { MatchView } from '@monsport/shared';
import * as sessionModule from '../../app/session';
import { LobbyScreen } from './LobbyScreen';

vi.mock('@monsport/client', async () => {
  const actual = await vi.importActual<typeof import('@monsport/client')>('@monsport/client');
  return { ...actual, api: vi.fn() };
});

let streamOnChange: (() => void) | undefined;
vi.mock('./useLobbyStream.ts', () => ({
  useLobbyStream: (onChange: () => void) => {
    streamOnChange = onChange;
  },
}));

const USER_ID = '00000000-0000-4000-8000-0000000000a2';
const HOST_ID = '00000000-0000-4000-8000-0000000000a1';
const now = new Date('2026-11-02T10:00:00+07:00');

function makeMatch(n: number, overrides: Partial<MatchView> = {}): MatchView {
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    bookingId: '00000000-0000-4000-8000-0000000000b1',
    hostId: HOST_ID,
    hostName: `Host ${n}`,
    sport: 'BADMINTON',
    capacity: 10,
    joinedCount: 4,
    pricePerSlot: 40_000,
    status: 'OPEN',
    bookingStatus: 'CONFIRMED',
    startAt: '2026-11-03T20:00:00+07:00',
    endAt: '2026-11-03T21:00:00+07:00',
    courtName: `Sân ${n}`,
    venueName: `Đơn vị ${n}`,
    venueAddress: 'Địa chỉ',
    createdAt: '2026-11-01T10:00:00+07:00',
    ...overrides,
  } as MatchView;
}

const m1 = makeMatch(1);
const m2 = makeMatch(2, {
  sport: 'FOOTBALL',
  joinedCount: 6,
  capacity: 14,
  bookingStatus: 'PENDING',
  startAt: '2026-11-04T18:00:00+07:00',
  endAt: '2026-11-04T19:00:00+07:00',
});
const m3 = makeMatch(3, { startAt: '2026-11-02T07:00:00+07:00', endAt: '2026-11-02T08:00:00+07:00' });
const m4 = makeMatch(4, {
  sport: 'FOOTBALL',
  status: 'FULL',
  joinedCount: 10,
  startAt: '2026-11-03T19:00:00+07:00',
  endAt: '2026-11-03T20:00:00+07:00',
});

type User = sessionModule.SessionContextType['user'];
const player: User = { id: USER_ID, name: 'Người chơi', role: 'USER' } as User;

const api = () => vi.mocked(clientModule.api);
const callsTo = (prefix: string) => api().mock.calls.filter(([p]) => String(p).startsWith(prefix));

const lastFeed = () =>
  String(api().mock.calls.filter(([p]) => !String(p).startsWith('/api/matches/joined')).at(-1)?.[0]);

function mockApi(feed: MatchView[] | Error = [m1, m2, m3], joined: MatchView[] | Error = [m4]) {
  api().mockImplementation(async (path: string) => {
    if (path.startsWith('/api/matches/joined')) {
      if (joined instanceof Error) throw joined;
      return joined;
    }
    if (path.startsWith('/api/matches')) {
      if (feed instanceof Error) throw feed;
      return feed;
    }
    throw new Error(`unexpected ${path}`);
  });
}

function renderScreen(user: User) {
  vi.spyOn(sessionModule, 'useSession').mockReturnValue({
    user,
    setUser: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
    loading: false,
  });
  return render(
    <MemoryRouter initialEntries={['/phong-cho']}>
      <Routes>
        <Route path="/" element={<p>Trang chủ đặt sân</p>} />
        <Route path="/phong-cho" element={<LobbyScreen now={now} />} />
      </Routes>
    </MemoryRouter>,
  );
}

const cardIds = (c: HTMLElement) =>
  [...c.querySelectorAll('[data-match-id]')].map((el) => el.getAttribute('data-match-id'));
const card = (c: HTMLElement, m: MatchView) => c.querySelector<HTMLElement>(`[data-match-id="${m.id}"]`)!;

describe('LobbyScreen', () => {
  beforeEach(() => {
    streamOnChange = undefined;
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    api().mockReset();
  });

  it('AC-1: a USER sees M4, M1, M2 in start order with labels and without M3 or a phone number', async () => {
    mockApi();
    const { container } = renderScreen(player);
    await waitFor(() => expect(cardIds(container)).toEqual([m4.id, m1.id, m2.id]));

    const c1 = card(container, m1);
    for (const text of [
      'Host 1',
      'Đơn vị 1',
      'Sân 1',
      '20:00–21:00',
      '4/10 suất',
      '40.000đ/suất',
      'Đã xác nhận',
      'Cầu lông',
    ]) {
      expect(c1.textContent).toContain(text);
    }
    expect(c1.textContent).toContain(clientModule.dayHeading('2026-11-03'));
    expect(c1.querySelector('button')?.textContent).toBe('Vào trận');
    expect(card(container, m2).textContent).toContain('Chưa xác nhận');

    const c4 = card(container, m4);
    expect(c4.textContent).toContain('Đầy');
    expect(c4.textContent).toContain('Bạn đã vào');
    expect(c4.querySelector('button')).toBeNull();
    expect(container.textContent).not.toMatch(/\d{9,}/);
    expect(callsTo('/api/matches/joined')).toHaveLength(1);
  });

  it('AC-1: a guest never calls /api/matches/joined', async () => {
    mockApi();
    const { container } = renderScreen(null);
    await waitFor(() => expect(cardIds(container)).toEqual([m1.id, m2.id]));
    expect(callsTo('/api/matches/joined')).toHaveLength(0);
  });

  it('AC-2: the sport and day chips send the exact URLs, filter every card, and toggle off when tapped again', async () => {
    mockApi();
    const { container } = renderScreen(player);
    await waitFor(() => expect(cardIds(container)).toHaveLength(3));

    fireEvent.click(screen.getByRole('button', { name: 'Bóng đá' }));
    await waitFor(() => expect(cardIds(container)).toEqual([m4.id, m2.id]));
    expect(api()).toHaveBeenCalledWith('/api/matches?sport=FOOTBALL');

    const chip2 = lobbyChips(now).find((c) => c.ymd === '2026-11-04')!;
    fireEvent.click(screen.getByRole('button', { name: chip2.label }));
    await waitFor(() => expect(cardIds(container)).toEqual([m2.id]));
    expect(api()).toHaveBeenCalledWith('/api/matches?sport=FOOTBALL&date=2026-11-04');

    const chip1 = lobbyChips(now).find((c) => c.ymd === '2026-11-03')!;
    fireEvent.click(screen.getByRole('button', { name: chip1.label }));
    await waitFor(() => expect(cardIds(container)).toEqual([m4.id]));

    fireEvent.click(screen.getByRole('button', { name: chip1.label }));
    await waitFor(() => expect(cardIds(container)).toEqual([m4.id, m2.id]));
    expect(lastFeed()).toBe('/api/matches?sport=FOOTBALL');

    fireEvent.click(screen.getByRole('button', { name: 'Cầu lông' }));
    await waitFor(() => expect(cardIds(container)).toEqual([m1.id]));
    expect(lastFeed()).toBe('/api/matches?sport=BADMINTON');
    fireEvent.click(screen.getByRole('button', { name: 'Cầu lông' }));
    await waitFor(() => expect(cardIds(container)).toHaveLength(3));
    expect(lastFeed()).toBe('/api/matches');
  });

  it('AC-3: an empty feed shows "Chưa có trận nào" and "Đặt sân" goes to /', async () => {
    mockApi([], []);
    renderScreen(player);
    expect(await screen.findByText('Chưa có trận nào')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Đặt sân' }));
    expect(await screen.findByText('Trang chủ đặt sân')).toBeDefined();
  });

  it('AC-3: a feed failure shows "Không tải được" and "Thử lại" reloads', async () => {
    mockApi(new Error('network'), []);
    const { container } = renderScreen(null);
    expect(await screen.findByText('Không tải được')).toBeDefined();
    mockApi([m1], []);
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(cardIds(container)).toEqual([m1.id]));
    expect(screen.queryByText('Không tải được')).toBeNull();
  });

  it('AC-3: a 401 from joined opens the login sheet with the session notice and keeps the feed', async () => {
    mockApi([m1], new ApiError(401, 'Chưa đăng nhập'));
    const { container } = renderScreen(player);
    expect(await screen.findByText('Phiên đăng nhập đã hết. Hãy đăng nhập lại.')).toBeDefined();
    expect(cardIds(container)).toEqual([m1.id]);
  });

  it('AC-3: a 5xx from joined shows the feed and "Thử lại" reloads only joined', async () => {
    mockApi([m1], new ApiError(500, 'Lỗi'));
    const { container } = renderScreen(player);
    const retry = await screen.findByRole('button', { name: 'Thử lại' });
    expect(cardIds(container)).toEqual([m1.id]);
    const feedBefore = api().mock.calls.filter(([p]) => p === '/api/matches').length;

    mockApi([m1], [m4]);
    fireEvent.click(retry);
    await waitFor(() => expect(cardIds(container)).toEqual([m4.id, m1.id]));
    expect(api().mock.calls.filter(([p]) => p === '/api/matches').length).toBe(feedBefore);
    expect(screen.queryByRole('button', { name: 'Thử lại' })).toBeNull();
  });

  it.each(['OWNER', 'ADMIN'] as const)(
    'AC-15: %s sees the feed, calls no joined, and "Vào trận" only shows the notice',
    async (role) => {
      mockApi();
      const { container } = renderScreen({ id: USER_ID, name: 'X', role } as User);
      await waitFor(() => expect(cardIds(container)).toEqual([m1.id, m2.id]));
      expect(callsTo('/api/matches/joined')).toHaveLength(0);

      const before = api().mock.calls.length;
      fireEvent.click(card(container, m1).querySelector('button')!);
      expect(await screen.findByText('Dùng tài khoản người chơi để vào trận')).toBeDefined();
      fireEvent.click(card(container, m1));
      expect(api().mock.calls.length).toBe(before);
      expect(api().mock.calls.some(([p]) => /\/join$|\/api\/matches\/0/.test(String(p)))).toBe(false);
    },
  );

  it('AC-16: cards and buttons are structured to avoid overflow and keep 44px tap targets', async () => {
    mockApi();
    const { container } = renderScreen(player);
    await waitFor(() => expect(cardIds(container)).toHaveLength(3));
    for (const article of container.querySelectorAll<HTMLElement>('article')) {
      expect(['0', '0px']).toContain(article.style.minWidth);
      expect(article.style.overflowX).not.toBe('scroll');
    }
    const venue = card(container, m1).querySelector<HTMLElement>('span')!;
    expect(venue.style.overflowWrap).toBe('anywhere');
    for (const b of container.querySelectorAll<HTMLElement>('article button, nav button')) {
      expect(parseInt(b.style.minHeight, 10)).toBeGreaterThanOrEqual(44);
    }
  });

  it('AC-4: reload requests during a flight make exactly one follow-up request', async () => {
    let release: (v: MatchView[]) => void = () => {};
    let first = true;
    api().mockImplementation(async (path: string) => {
      if (path === '/api/matches' && first) {
        first = false;
        return new Promise<MatchView[]>((resolve) => {
          release = resolve;
        });
      }
      return [m1];
    });
    const { container } = renderScreen(null);
    await waitFor(() => expect(streamOnChange).toBeDefined());
    expect(callsTo('/api/matches')).toHaveLength(1);

    act(() => {
      streamOnChange!();
      streamOnChange!();
    });
    expect(callsTo('/api/matches')).toHaveLength(1);

    await act(async () => release([m1]));
    await waitFor(() => expect(callsTo('/api/matches')).toHaveLength(2));
    await waitFor(() => expect(cardIds(container)).toEqual([m1.id]));

    act(() => streamOnChange!());
    await waitFor(() => expect(callsTo('/api/matches')).toHaveLength(3));
  });

  it('AC-4: a late response after a newer request is dropped', async () => {
    const resolvers: ((v: MatchView[]) => void)[] = [];
    api().mockImplementation(
      (path: string) =>
        new Promise<MatchView[]>((resolve) => {
          if (path.startsWith('/api/matches?')) resolvers.push(resolve);
          else resolvers.push(resolve);
        }) as never,
    );
    const { container } = renderScreen(null);
    await waitFor(() => expect(resolvers).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: 'Bóng đá' }));
    await waitFor(() => expect(resolvers).toHaveLength(2));
    await act(async () => resolvers[1]!([m2]));
    await act(async () => resolvers[0]!([m1]));
    expect(cardIds(container)).toEqual([m2.id]);
  });
});
