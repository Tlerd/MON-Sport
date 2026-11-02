import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as clientModule from '@monsport/client';
import { ApiError } from '@monsport/client';
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

// A stub that logs in or closes on a tap, so the test controls the moment of the action.
vi.mock('../auth/LoginSheet.tsx', () => ({
  LoginSheet: ({
    open,
    notice,
    onClose,
    onLoggedIn,
  }: {
    open: boolean;
    notice?: string;
    onClose: () => void;
    onLoggedIn?: () => void;
  }) =>
    open ? (
      <div role="dialog">
        <p>{notice ?? 'Đăng nhập'}</p>
        <button type="button" onClick={() => onLoggedIn?.()}>
          Đăng nhập xong
        </button>
        <button type="button" onClick={() => onClose()}>
          Đóng
        </button>
      </div>
    ) : null,
}));

type User = sessionModule.SessionContextType['user'];
const USER_ID = '00000000-0000-4000-8000-0000000000a2';
const NOTICE = 'Phiên đăng nhập đã hết. Hãy đăng nhập lại.';
const now = new Date('2026-11-02T10:00:00+07:00');
const match = {
  id: '00000000-0000-4000-8000-000000000001',
  bookingId: '00000000-0000-4000-8000-0000000000b1',
  hostId: '00000000-0000-4000-8000-0000000000a1',
  hostName: 'Host 1',
  sport: 'BADMINTON',
  capacity: 10,
  joinedCount: 4,
  pricePerSlot: 40_000,
  status: 'OPEN',
  bookingStatus: 'CONFIRMED',
  startAt: '2026-11-03T20:00:00+07:00',
  endAt: '2026-11-03T21:00:00+07:00',
  courtName: 'Sân 1',
  venueName: 'Đơn vị 1',
  venueAddress: 'Địa chỉ',
  createdAt: '2026-11-01T10:00:00+07:00',
} as MatchView;

const api = () => vi.mocked(clientModule.api);
const joinedCalls = () => api().mock.calls.filter(([p]) => String(p).startsWith('/api/matches/joined'));

function setup(initial: User) {
  let current = initial;
  vi.spyOn(sessionModule, 'useSession').mockImplementation(
    () =>
      ({
        user: current,
        setUser: vi.fn(),
        login: vi.fn(),
        logout: vi.fn(),
        refresh: vi.fn(),
        loading: false,
      }) as unknown as sessionModule.SessionContextType,
  );
  const tree = () => (
    <MemoryRouter initialEntries={['/phong-cho']}>
      <Routes>
        <Route path="/phong-cho" element={<LobbyScreen now={now} />} />
      </Routes>
    </MemoryRouter>
  );
  const view = render(tree());
  return {
    switchTo(user: User) {
      current = user;
      view.rerender(tree());
    },
  };
}

describe('LobbyScreen session expiry', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    api().mockReset();
    streamOnChange = undefined;
  });

  it('AC-15: after an expired session, a login as OWNER does not call GET /api/matches/joined', async () => {
    let expired = false;
    api().mockImplementation(async (path: string) => {
      if (path.startsWith('/api/matches/joined')) {
        if (expired) throw new ApiError(401, 'expired');
        return [];
      }
      return [match];
    });
    const view = setup({ id: USER_ID, name: 'A', role: 'USER' } as User);
    await waitFor(() => expect(joinedCalls()).toHaveLength(1));
    await screen.findByText('Sân 1');

    expired = true;
    await act(async () => streamOnChange!());
    expect(await screen.findByText(NOTICE)).toBeDefined();

    // The person logs in as an OWNER: the session changes first, then the sheet calls onLoggedIn.
    const before = joinedCalls().length;
    view.switchTo({ id: USER_ID, name: 'B', role: 'OWNER' } as User);
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập xong' }));
    await waitFor(() => expect(screen.getByText('Sân 1')).toBeDefined());
    expect(joinedCalls()).toHaveLength(before);
    expect(screen.queryByText('Không tải được trận bạn đã vào')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Thử lại' })).toBeNull();
  });

  it('AC-3: the login sheet opens once for each expiry, not on every reload', async () => {
    api().mockImplementation(async (path: string) => {
      if (path.startsWith('/api/matches/joined')) throw new ApiError(401, 'expired');
      return [match];
    });
    setup({ id: USER_ID, name: 'A', role: 'USER' } as User);
    expect(await screen.findByText(NOTICE)).toBeDefined();
    const closeCalls = joinedCalls().length;

    // The sheet is open. Another reload must not open a second one.
    await act(async () => streamOnChange!());
    await waitFor(() => expect(joinedCalls().length).toBeGreaterThan(closeCalls));
    expect(screen.getAllByText(NOTICE)).toHaveLength(1);
  });

  it('AC-3: closing the session-expiry sheet without a login clears expiredShown so the next 401 reopens it', async () => {
    api().mockImplementation(async (path: string) => {
      if (path.startsWith('/api/matches/joined')) throw new ApiError(401, 'expired');
      return [match];
    });
    setup({ id: USER_ID, name: 'A', role: 'USER' } as User);
    expect(await screen.findByText(NOTICE)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(screen.queryByText(NOTICE)).toBeNull();

    await act(async () => streamOnChange!());
    expect(await screen.findByText(NOTICE)).toBeDefined();
  });

  it('AC-3: logging in as a different account from the session-expiry sheet fetches only once', async () => {
    let expired = true;
    api().mockImplementation(async (path: string) => {
      if (path.startsWith('/api/matches/joined')) {
        if (expired) throw new ApiError(401, 'expired');
        return [];
      }
      return [match];
    });
    const view = setup({ id: USER_ID, name: 'A', role: 'USER' } as User);
    expect(await screen.findByText(NOTICE)).toBeDefined();

    expired = false;
    const joinedBefore = joinedCalls().length;
    view.switchTo({ id: '00000000-0000-4000-8000-0000000000b9', name: 'B', role: 'USER' } as User);
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập xong' }));
    await waitFor(() => expect(joinedCalls()).toHaveLength(joinedBefore + 1));
    expect(joinedCalls()).toHaveLength(joinedBefore + 1);
  });
});
