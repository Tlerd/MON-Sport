import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as clientModule from '@monsport/client';
import { ApiError, lobbyChips } from '@monsport/client';
import type { MatchDetailView, MatchView } from '@monsport/shared';
import * as sessionModule from '../../app/session';
import { SessionProvider } from '../../app/session';
import { LobbyMatchCard } from './LobbyMatchCard';
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
    expect(c4.textContent).not.toContain('Vào trận');
    expect(c4.querySelector('button')?.textContent).toBe('Rời trận');
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

  it('AC-15: an OWNER taps the card body and sees the notice with no call to /api/matches/joined or /api/matches/:id', async () => {
    mockApi();
    const { container } = renderScreen({ id: USER_ID, name: 'X', role: 'OWNER' } as User);
    await waitFor(() => expect(cardIds(container)).toEqual([m1.id, m2.id]));
    expect(callsTo('/api/matches/joined')).toHaveLength(0);

    const before = api().mock.calls.length;
    fireEvent.click(card(container, m1));
    expect(await screen.findByText('Dùng tài khoản người chơi để vào trận')).toBeDefined();
    expect(api().mock.calls.length).toBe(before);
    expect(callsTo('/api/matches/joined')).toHaveLength(0);
    expect(callsTo(`/api/matches/${m1.id}`)).toHaveLength(0);
  });

  it('AC-15: a tap on "Vào trận" calls onJoin and not onOpen', () => {
    const onJoin = vi.fn();
    const onOpen = vi.fn();
    render(
      <LobbyMatchCard
        card={{ match: m1, joined: false, isHost: false }}
        onJoin={onJoin}
        onOpen={onOpen}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Vào trận' }));
    expect(onJoin).toHaveBeenCalledTimes(1);
    expect(onJoin).toHaveBeenCalledWith(m1);
    expect(onOpen).not.toHaveBeenCalled();
  });

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

  it('AC-6: a guest tapping "Vào trận" opens the login sheet without calling join, and after login calls POST /api/matches/:id/join once', async () => {
    let currentUser: User = null;
    let joined = false;
    const detailM1: MatchDetailView = {
      ...m1,
      joinedCount: 5,
      viewerRole: 'PLAYER',
      players: [{ userId: USER_ID, name: 'Người chơi', phone: null, joinedAt: '2026-11-02T10:00:00+07:00' }],
    };

    api().mockImplementation(async (path: string, init?: unknown) => {
      if (path === '/api/auth/me') {
        if (!currentUser) throw new ApiError(401, 'Chưa đăng nhập');
        return currentUser;
      }
      if (path === '/api/auth/login') {
        currentUser = player;
        return { ok: true };
      }
      if (path === `/api/matches/${m1.id}/join`) {
        expect((init as { method?: string })?.method).toBe('POST');
        joined = true;
        return detailM1;
      }
      if (path.startsWith('/api/matches/joined')) {
        return joined ? [{ ...m1, joinedCount: 5 }] : [];
      }
      if (path.startsWith('/api/matches')) {
        return [joined ? { ...m1, joinedCount: 5 } : m1, m2];
      }
      throw new Error(`unexpected ${path}`);
    });

    const { container } = render(
      <SessionProvider>
        <MemoryRouter initialEntries={['/phong-cho']}>
          <Routes>
            <Route path="/phong-cho" element={<LobbyScreen now={now} />} />
          </Routes>
        </MemoryRouter>
      </SessionProvider>,
    );

    await waitFor(() => expect(cardIds(container)).toEqual([m1.id, m2.id]));
    const c1 = card(container, m1);
    fireEvent.click(c1.querySelector('button')!);

    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeDefined();
    expect(callsTo(`/api/matches/${m1.id}/join`)).toHaveLength(0);

    fireEvent.change(screen.getByLabelText('Số điện thoại'), { target: { value: '0901234567' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'matkhau123' } });
    const submitBtn = screen
      .getAllByRole('button', { name: 'Đăng nhập' })
      .find((btn) => btn.getAttribute('type') === 'submit')!;
    fireEvent.click(submitBtn);

    await waitFor(() => expect(callsTo(`/api/matches/${m1.id}/join`)).toHaveLength(1));
    await waitFor(() => expect(card(container, m1).textContent).toContain('5/10 suất'));
    expect(card(container, m1).textContent).toContain('Bạn đã vào');
    expect(callsTo(`/api/matches/${m1.id}/join`)).toHaveLength(1);
  });

  it('AC-7: join disables the button without optimistic increment, updates to 5/10, "Bạn đã vào" and "Rời trận" on 200, and keeps "Bạn đã vào" after SSE reload', async () => {
    let joined = false;
    let resolveJoin!: (v: MatchDetailView) => void;
    const detailM1: MatchDetailView = {
      ...m1,
      joinedCount: 5,
      viewerRole: 'PLAYER',
      players: [{ userId: USER_ID, name: 'Người chơi', phone: null, joinedAt: '2026-11-02T10:00:00+07:00' }],
    };

    api().mockImplementation(async (path: string, init?: unknown) => {
      if (path === `/api/matches/${m1.id}/join`) {
        expect((init as { method?: string })?.method).toBe('POST');
        return new Promise<MatchDetailView>((r) => {
          resolveJoin = r;
        });
      }
      if (path.startsWith('/api/matches/joined')) {
        return joined ? [{ ...m1, joinedCount: 5 }] : [];
      }
      if (path.startsWith('/api/matches')) {
        return [joined ? { ...m1, joinedCount: 5 } : m1];
      }
      throw new Error(`unexpected ${path}`);
    });

    const { container } = renderScreen(player);
    await waitFor(() => expect(cardIds(container)).toEqual([m1.id]));

    const joinBtn = card(container, m1).querySelector('button') as HTMLButtonElement;
    expect(joinBtn.textContent).toBe('Vào trận');
    fireEvent.click(joinBtn);

    // While pending: button is disabled, and joinedCount has NOT optimistically incremented
    await waitFor(() => expect(joinBtn.disabled).toBe(true));
    expect(card(container, m1).textContent).toContain('4/10 suất');
    expect(card(container, m1).textContent).not.toContain('5/10 suất');
    expect(card(container, m1).textContent).not.toContain('Bạn đã vào');

    // Resolve join
    joined = true;
    await act(async () => resolveJoin(detailM1));

    await waitFor(() => expect(card(container, m1).textContent).toContain('5/10 suất'));
    expect(card(container, m1).textContent).toContain('Bạn đã vào');
    expect(card(container, m1).querySelector('button')?.textContent).toBe('Rời trận');

    // After SSE event and reload, M1 still shows "Bạn đã vào"
    const joinedBeforeSse = callsTo('/api/matches/joined').length;
    await act(async () => streamOnChange!());
    await waitFor(() => expect(callsTo('/api/matches/joined').length).toBeGreaterThan(joinedBeforeSse));
    expect(card(container, m1).textContent).toContain('Bạn đã vào');
    expect(card(container, m1).textContent).toContain('5/10 suất');
  });

  it('AC-8: join 409 ("Trận đã đủ người", "Bạn đã ở trong trận này") shows the API message and reloads; join 401 opens the session login sheet', async () => {
    for (const msg of ['Trận đã đủ người', 'Bạn đã ở trong trận này']) {
      api().mockImplementation(async (path: string) => {
        if (path === `/api/matches/${m1.id}/join`) throw new ApiError(409, msg);
        if (path.startsWith('/api/matches/joined')) return [];
        if (path.startsWith('/api/matches')) return [m1];
        throw new Error(`unexpected ${path}`);
      });

      const { container } = renderScreen(player);
      await waitFor(() => expect(cardIds(container)).toEqual([m1.id]));
      const feedBefore = callsTo('/api/matches').length;

      fireEvent.click(card(container, m1).querySelector('button')!);
      expect((await screen.findByRole('alert')).textContent).toBe(msg);
      await waitFor(() => expect(callsTo('/api/matches').length).toBeGreaterThan(feedBefore));

      cleanup();
      vi.restoreAllMocks();
      api().mockReset();
    }

    // 401 case
    api().mockImplementation(async (path: string) => {
      if (path === `/api/matches/${m1.id}/join`) throw new ApiError(401, 'Chưa đăng nhập');
      if (path.startsWith('/api/matches/joined')) return [];
      if (path.startsWith('/api/matches')) return [m1];
      throw new Error(`unexpected ${path}`);
    });

    const { container } = renderScreen(player);
    await waitFor(() => expect(cardIds(container)).toEqual([m1.id]));
    fireEvent.click(card(container, m1).querySelector('button')!);

    expect(await screen.findByText('Phiên đăng nhập đã hết. Hãy đăng nhập lại.')).toBeDefined();
  });

  it('AC-9: "Rời trận" opens "Rời trận này?" with venue, court, day and time; confirm calls POST /api/matches/:id/leave and returns the card to "4/10 suất" and "Vào trận"; 409 shows the message in the sheet and reloads', async () => {
    let joined = true;
    let shouldFail409 = true;
    const m1Joined = { ...m1, joinedCount: 5 };
    const detailAfterLeave: MatchDetailView = {
      ...m1,
      joinedCount: 4,
      viewerRole: 'NONE',
      players: [],
    };

    api().mockImplementation(async (path: string, init?: unknown) => {
      if (path === `/api/matches/${m1.id}/leave`) {
        expect((init as { method?: string })?.method).toBe('POST');
        if (shouldFail409) {
          throw new ApiError(409, 'Đã tới giờ bắt đầu, không rời trận được nữa');
        }
        joined = false;
        return detailAfterLeave;
      }
      if (path.startsWith('/api/matches/joined')) {
        return joined ? [m1Joined] : [];
      }
      if (path.startsWith('/api/matches')) {
        return [joined ? m1Joined : m1];
      }
      throw new Error(`unexpected ${path}`);
    });

    const { container } = renderScreen(player);
    await waitFor(() => expect(cardIds(container)).toEqual([m1.id]));
    expect(card(container, m1).textContent).toContain('5/10 suất');

    // Click "Rời trận" on card
    fireEvent.click(screen.getByRole('button', { name: 'Rời trận' }));
    const dialog = await screen.findByRole('dialog', { name: 'Rời trận này?' });
    expect(dialog.textContent).toContain('Đơn vị 1');
    expect(dialog.textContent).toContain('Sân 1');
    expect(dialog.textContent).toContain(clientModule.dayHeading('2026-11-03'));
    expect(dialog.textContent).toContain('20:00–21:00');

    // First attempt returns 409
    const feedBefore409 = callsTo('/api/matches').length;
    const confirmBtn = Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === 'Rời trận')!;
    fireEvent.click(confirmBtn);

    expect((await screen.findByRole('alert')).textContent).toBe('Đã tới giờ bắt đầu, không rời trận được nữa');
    expect(screen.getByRole('dialog', { name: 'Rời trận này?' })).toBeDefined();
    await waitFor(() => expect(callsTo('/api/matches').length).toBeGreaterThan(feedBefore409));

    // Second attempt succeeds
    shouldFail409 = false;
    fireEvent.click(confirmBtn);

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(card(container, m1).textContent).toContain('4/10 suất'));
    expect(card(container, m1).querySelector('button')?.textContent).toBe('Vào trận');
    expect(card(container, m1).textContent).not.toContain('Bạn đã vào');
  });

  it('AC-10: guest tapping card body sees "Đăng nhập để xem người chơi" with no GET /api/matches/:id; USER (PLAYER and NONE) sees active player names and no phone number; late detail response is dropped', async () => {
    // 1. Guest
    mockApi([m1], []);
    const { container: guestContainer } = renderScreen(null);
    await waitFor(() => expect(cardIds(guestContainer)).toEqual([m1.id]));
    fireEvent.click(card(guestContainer, m1));
    expect(await screen.findByText('Đăng nhập để xem người chơi')).toBeDefined();
    expect(callsTo(`/api/matches/${m1.id}`)).toHaveLength(0);
    cleanup();
    vi.restoreAllMocks();
    api().mockReset();

    // 2. USER as PLAYER and NONE: sees active player names, never sees phone
    for (const viewerRole of ['PLAYER', 'NONE'] as const) {
      const detail: MatchDetailView = {
        ...m1,
        viewerRole,
        players: [
          {
            userId: '00000000-0000-4000-8000-0000000000p1',
            name: 'Trần Văn An',
            phone: '0911222333' as unknown as null, // Even if present, UI must hide it for non-HOST
            joinedAt: '2026-11-02T09:00:00+07:00',
          },
          {
            userId: '00000000-0000-4000-8000-0000000000p2',
            name: 'Lê Thị Bình',
            phone: null,
            joinedAt: '2026-11-02T09:05:00+07:00',
          },
        ],
      };

      api().mockImplementation(async (path: string) => {
        if (path === `/api/matches/${m1.id}`) return detail;
        if (path.startsWith('/api/matches/joined')) return viewerRole === 'PLAYER' ? [m1] : [];
        if (path.startsWith('/api/matches')) return [m1];
        throw new Error(`unexpected ${path}`);
      });

      const { container } = renderScreen(player);
      await waitFor(() => expect(cardIds(container)).toEqual([m1.id]));
      fireEvent.click(card(container, m1));

      const dialog = await screen.findByRole('dialog');
      await waitFor(() => expect(dialog.textContent).toContain('Trần Văn An'));
      expect(dialog.textContent).toContain('Lê Thị Bình');
      expect(dialog.textContent).not.toMatch(/0\d{9}/);
      expect(dialog.querySelector('a[href^="tel:"]')).toBeNull();
      expect(dialog.textContent).toContain(viewerRole === 'NONE' ? 'Vào trận' : 'Rời trận');

      cleanup();
      vi.restoreAllMocks();
      api().mockReset();
    }

    // 3. Late detail response after closing or opening another match is dropped
    let resolveM1!: (v: MatchDetailView) => void;
    const detailM2: MatchDetailView = {
      ...m2,
      viewerRole: 'NONE',
      players: [{ userId: '00000000-0000-4000-8000-0000000000p9', name: 'Người M2', phone: null, joinedAt: '2026-11-02T09:00:00+07:00' }],
    };
    api().mockImplementation(async (path: string) => {
      if (path === `/api/matches/${m1.id}`) {
        return new Promise<MatchDetailView>((r) => {
          resolveM1 = r;
        });
      }
      if (path === `/api/matches/${m2.id}`) return detailM2;
      if (path.startsWith('/api/matches/joined')) return [];
      if (path.startsWith('/api/matches')) return [m1, m2];
      throw new Error(`unexpected ${path}`);
    });

    const { container } = renderScreen(player);
    await waitFor(() => expect(cardIds(container)).toEqual([m1.id, m2.id]));
    fireEvent.click(card(container, m1));
    await screen.findByRole('dialog');

    // Open M2 before M1 finishes
    fireEvent.click(card(container, m2));
    await waitFor(() => expect(screen.getByRole('dialog').textContent).toContain('Người M2'));

    await act(async () =>
      resolveM1({
        ...m1,
        viewerRole: 'NONE',
        players: [{ userId: '00000000-0000-4000-8000-0000000000p8', name: 'Người M1 Trễ', phone: null, joinedAt: '2026-11-02T09:00:00+07:00' }],
      }),
    );
    expect(screen.getByRole('dialog').textContent).not.toContain('Người M1 Trễ');
    expect(screen.getByRole('dialog').textContent).toContain('Người M2');
  });

  it('AC-12: a HOST of a CONFIRMED match under 6 h away has no "Hủy trận" on the card or in the sheet, only the hint', async () => {
    const hostUser: User = { id: HOST_ID, name: 'Host 1', role: 'USER' } as User;
    // now = 02/11/2026 10:00 (UTC+7): this match starts at 14:00, 4 h ahead (CALL_OWNER).
    const soon = makeMatch(7, {
      bookingStatus: 'CONFIRMED',
      startAt: '2026-11-02T14:00:00+07:00',
      endAt: '2026-11-02T15:00:00+07:00',
    });
    const detail: MatchDetailView = { ...soon, viewerRole: 'HOST', players: [] };
    api().mockImplementation(async (path: string) => {
      if (path === `/api/matches/${soon.id}`) return detail;
      if (path.startsWith('/api/matches/joined')) return [soon];
      if (path.startsWith('/api/matches')) return [soon];
      throw new Error(`unexpected ${path}`);
    });

    const { container } = renderScreen(hostUser);
    await waitFor(() => expect(cardIds(container)).toEqual([soon.id]));
    const names = (el: Element) => [...el.querySelectorAll('button')].map((b) => b.textContent);
    expect(names(card(container, soon))).not.toContain('Hủy trận');
    expect(card(container, soon).textContent).toContain('Còn dưới 6 giờ');

    fireEvent.click(card(container, soon));
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(dialog.textContent).toContain('Còn dưới 6 giờ'));
    expect(names(dialog)).not.toContain('Hủy trận');
  });

  it('AC-11: a HOST opening the detail sheet sees player names with tel: links, "Hủy trận", and no "Rời trận"', async () => {
    const hostUser: User = { id: HOST_ID, name: 'Host 1', role: 'USER' } as User;
    const detail: MatchDetailView = {
      ...m1,
      viewerRole: 'HOST',
      players: [
        {
          userId: USER_ID,
          name: 'Người chơi A',
          phone: '0987654321',
          joinedAt: '2026-11-02T09:00:00+07:00',
        },
      ],
    };

    api().mockImplementation(async (path: string) => {
      if (path === `/api/matches/${m1.id}`) return detail;
      if (path.startsWith('/api/matches/joined')) return [m1];
      if (path.startsWith('/api/matches')) return [m1];
      throw new Error(`unexpected ${path}`);
    });

    const { container } = renderScreen(hostUser);
    await waitFor(() => expect(cardIds(container)).toEqual([m1.id]));
    fireEvent.click(card(container, m1));

    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(dialog.textContent).toContain('Người chơi A'));
    const telLink = dialog.querySelector('a[href="tel:0987654321"]') as HTMLAnchorElement;
    expect(telLink).not.toBeNull();
    expect(telLink.textContent).toBe('0987654321');

    const buttons = Array.from(dialog.querySelectorAll('button')).map((b) => b.textContent);
    expect(buttons).toContain('Hủy trận');
    expect(buttons).not.toContain('Rời trận');
    expect(buttons).not.toContain('Vào trận');
  });

  it('AC-12: "Hủy trận" opens "Hủy trận này?" stating the match and its booking will be cancelled; confirm calls POST /api/matches/:id/cancel and removes the card; 409 shows the API message and reloads; 401 opens the session login sheet', async () => {
    const hostUser: User = { id: HOST_ID, name: 'Host 1', role: 'USER' } as User;
    let cancelled = false;
    let mode: '409' | '200' | '401' = '409';
    const detail: MatchDetailView = {
      ...m1,
      viewerRole: 'HOST',
      players: [],
    };

    api().mockImplementation(async (path: string, init?: unknown) => {
      if (path === `/api/matches/${m1.id}`) return detail;
      if (path === `/api/matches/${m1.id}/cancel`) {
        expect((init as { method?: string })?.method).toBe('POST');
        if (mode === '409') throw new ApiError(409, 'Không hủy được trận này');
        if (mode === '401') throw new ApiError(401, 'Chưa đăng nhập');
        cancelled = true;
        return { ...m1, status: 'CANCELLED' };
      }
      if (path.startsWith('/api/matches/joined')) return cancelled ? [] : [m1];
      if (path.startsWith('/api/matches')) return cancelled ? [m2] : [m1, m2];
      throw new Error(`unexpected ${path}`);
    });

    const { container } = renderScreen(hostUser);
    await waitFor(() => expect(cardIds(container)).toEqual([m1.id, m2.id]));

    // Open detail sheet, then click "Hủy trận"
    fireEvent.click(card(container, m1));
    const detailDialog = await screen.findByRole('dialog');
    await waitFor(() =>
      expect(Array.from(detailDialog.querySelectorAll('button')).map((b) => b.textContent)).toContain('Hủy trận'),
    );
    fireEvent.click(Array.from(detailDialog.querySelectorAll('button')).find((b) => b.textContent === 'Hủy trận')!);

    const cancelDialog = await screen.findByRole('dialog', { name: 'Hủy trận này?' });
    expect(cancelDialog.textContent).toContain('Trận và booking của trận sẽ bị hủy');

    // 409 shows message and reloads
    const feedBefore = callsTo('/api/matches').length;
    const confirmBtn = Array.from(cancelDialog.querySelectorAll('button')).find((b) => b.textContent === 'Hủy trận')!;
    fireEvent.click(confirmBtn);
    expect((await screen.findByRole('alert')).textContent).toBe('Không hủy được trận này');
    await waitFor(() => expect(callsTo('/api/matches').length).toBeGreaterThan(feedBefore));

    // 200 removes card from feed and closes sheets
    mode = '200';
    fireEvent.click(confirmBtn);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(cardIds(container)).toEqual([m2.id]));

    // 401 opens session login sheet
    cleanup();
    vi.restoreAllMocks();
    api().mockReset();
    cancelled = false;
    mode = '401';
    api().mockImplementation(async (path: string) => {
      if (path === `/api/matches/${m1.id}/cancel`) throw new ApiError(401, 'Chưa đăng nhập');
      if (path.startsWith('/api/matches/joined')) return [m1];
      if (path.startsWith('/api/matches')) return [m1];
      throw new Error(`unexpected ${path}`);
    });
    const { container: c2 } = renderScreen(hostUser);
    await waitFor(() => expect(cardIds(c2)).toEqual([m1.id]));
    fireEvent.click(screen.getByRole('button', { name: 'Hủy trận' }));
    const dlg = await screen.findByRole('dialog', { name: 'Hủy trận này?' });
    fireEvent.click(Array.from(dlg.querySelectorAll('button')).find((b) => b.textContent === 'Hủy trận')!);
    expect(await screen.findByText('Phiên đăng nhập đã hết. Hãy đăng nhập lại.')).toBeDefined();
  });

  it('AC-18: on a FULL match M4, a PLAYER has "Rời trận" and after leaving M4 is OPEN and stays in the feed; a HOST has "Hủy trận" and after cancelling M4 leaves the feed', async () => {
    // Part 1: PLAYER in FULL match M4 leaves -> M4 becomes OPEN and stays in feed
    let left = false;
    const m4OpenAfterLeave: MatchView = { ...m4, status: 'OPEN', joinedCount: 9 };
    const detailM4Player: MatchDetailView = {
      ...m4,
      viewerRole: 'PLAYER',
      players: [{ userId: USER_ID, name: 'Người chơi', phone: null, joinedAt: '2026-11-02T09:00:00+07:00' }],
    };

    api().mockImplementation(async (path: string) => {
      if (path === `/api/matches/${m4.id}`) return detailM4Player;
      if (path === `/api/matches/${m4.id}/leave`) {
        left = true;
        return { ...m4OpenAfterLeave, viewerRole: 'NONE', players: [] } as MatchDetailView;
      }
      if (path.startsWith('/api/matches/joined')) return left ? [] : [m4];
      if (path.startsWith('/api/matches')) return left ? [m4OpenAfterLeave, m1] : [m1];
      throw new Error(`unexpected ${path}`);
    });

    const { container } = renderScreen(player);
    await waitFor(() => expect(cardIds(container)).toEqual([m4.id, m1.id]));
    expect(card(container, m4).querySelector('button')?.textContent).toBe('Rời trận');

    // Open detail sheet for M4: also has "Rời trận"
    fireEvent.click(card(container, m4));
    const detailDialog = await screen.findByRole('dialog');
    await waitFor(() =>
      expect(Array.from(detailDialog.querySelectorAll('button')).map((b) => b.textContent)).toContain('Rời trận'),
    );
    fireEvent.click(Array.from(detailDialog.querySelectorAll('button')).find((b) => b.textContent === 'Rời trận')!);

    const leaveDialog = await screen.findByRole('dialog', { name: 'Rời trận này?' });
    fireEvent.click(Array.from(leaveDialog.querySelectorAll('button')).find((b) => b.textContent === 'Rời trận')!);

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(card(container, m4).textContent).toContain('9/10 suất'));
    expect(cardIds(container)).toEqual([m4.id, m1.id]);
    expect(card(container, m4).textContent).not.toContain('Đầy');
    expect(card(container, m4).querySelector('button')?.textContent).toBe('Vào trận');

    cleanup();
    vi.restoreAllMocks();
    api().mockReset();

    // Part 2: HOST of FULL match M4 cancels -> M4 leaves the feed
    const hostUser: User = { id: HOST_ID, name: 'Host 4', role: 'USER' } as User;
    let cancelled = false;
    const detailM4Host: MatchDetailView = {
      ...m4,
      viewerRole: 'HOST',
      players: [],
    };

    api().mockImplementation(async (path: string) => {
      if (path === `/api/matches/${m4.id}`) return detailM4Host;
      if (path === `/api/matches/${m4.id}/cancel`) {
        cancelled = true;
        return { ...m4, status: 'CANCELLED' };
      }
      if (path.startsWith('/api/matches/joined')) return cancelled ? [] : [m4];
      if (path.startsWith('/api/matches')) return [m2];
      throw new Error(`unexpected ${path}`);
    });

    const { container: hostContainer } = renderScreen(hostUser);
    await waitFor(() => expect(cardIds(hostContainer)).toEqual([m4.id, m2.id]));
    expect(card(hostContainer, m4).querySelector('button')?.textContent).toBe('Hủy trận');

    fireEvent.click(card(hostContainer, m4));
    const hostDetailDialog = await screen.findByRole('dialog');
    await waitFor(() =>
      expect(Array.from(hostDetailDialog.querySelectorAll('button')).map((b) => b.textContent)).toContain('Hủy trận'),
    );
    fireEvent.click(Array.from(hostDetailDialog.querySelectorAll('button')).find((b) => b.textContent === 'Hủy trận')!);

    const cancelDialog = await screen.findByRole('dialog', { name: 'Hủy trận này?' });
    fireEvent.click(Array.from(cancelDialog.querySelectorAll('button')).find((b) => b.textContent === 'Hủy trận')!);

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(cardIds(hostContainer)).toEqual([m2.id]));
  });
});
