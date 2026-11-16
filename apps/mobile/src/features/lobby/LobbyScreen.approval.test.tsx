import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as clientModule from '@monsport/client';
import { ApiError } from '@monsport/client';
import type { MatchDetailView, MatchView } from '@monsport/shared';
import * as sessionModule from '../../app/session';
import { LobbyScreen } from './LobbyScreen';

vi.mock('@monsport/client', async () => {
  const actual = await vi.importActual<typeof import('@monsport/client')>('@monsport/client');
  return { ...actual, api: vi.fn() };
});
const stream = vi.hoisted(() => ({ onChange: undefined as undefined | (() => void) }));
vi.mock('./useLobbyStream.ts', () => ({
  useLobbyStream: (onChange: () => void) => {
    stream.onChange = onChange;
  },
}));

const USER_ID = '00000000-0000-4000-8000-0000000000a2';
const HOST_ID = '00000000-0000-4000-8000-0000000000a1';
const now = new Date('2026-11-02T10:00:00+07:00');

function makeMatch(n: number, over: Partial<MatchView> = {}): MatchView {
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
    startAt: `2026-11-0${2 + n}T20:00:00+07:00`,
    endAt: `2026-11-0${2 + n}T21:00:00+07:00`,
    courtName: `Sân ${n}`,
    venueName: `Đơn vị ${n}`,
    venueAddress: 'Địa chỉ',
    createdAt: '2026-11-01T10:00:00+07:00',
    ...over,
  } as MatchView;
}

const instant = makeMatch(1, { joinMode: 'INSTANT' });
const approval = makeMatch(2, { joinMode: 'APPROVAL' });
const legacy = makeMatch(3); // no joinMode: the field is optional, so it means INSTANT

const player = { id: USER_ID, name: 'Người chơi', role: 'USER' } as sessionModule.SessionContextType['user'];
const api = () => vi.mocked(clientModule.api);
const callsTo = (path: string) => api().mock.calls.filter(([p]) => p === path);
const card = (c: HTMLElement, m: MatchView) => c.querySelector<HTMLElement>(`[data-match-id="${m.id}"]`)!;

const detailOf = (m: MatchView, over: Partial<MatchDetailView> = {}): MatchDetailView =>
  ({ ...m, viewerRole: 'NONE', players: [], ...over }) as MatchDetailView;

function renderScreen() {
  vi.spyOn(sessionModule, 'useSession').mockReturnValue({
    user: player,
    setUser: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
    loading: false,
  });
  return render(
    <MemoryRouter initialEntries={['/phong-cho']}>
      <Routes>
        <Route path="/phong-cho" element={<LobbyScreen now={now} />} />
      </Routes>
    </MemoryRouter>,
  );
}

function mockApi(handlers: Record<string, (init?: unknown) => unknown> = {}, feed: MatchView[] = [instant, approval, legacy]) {
  api().mockImplementation(async (path: string, init?: unknown) => {
    const handler = handlers[path];
    if (handler) return handler(init);
    if (path.startsWith('/api/matches/joined')) return [];
    if (path === '/api/matches') return feed;
    throw new Error(`unexpected ${path}`);
  });
}

const buttonNames = (el: HTMLElement) => [...el.querySelectorAll('button')].map((b) => b.textContent);

describe('LobbyScreen: host approval (F-035 step 1)', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    api().mockReset();
  });

  it('AC-2: the "Host duyệt" card has the label and "Xin vào"; "Vào ngay" and a card without joinMode keep "Vào trận"', async () => {
    mockApi();
    const { container } = renderScreen();
    await waitFor(() => expect(card(container, approval)).not.toBeNull());

    const a = card(container, approval);
    expect(a.textContent).toContain('Host duyệt');
    expect(buttonNames(a)).toContain('Xin vào');
    expect(buttonNames(a)).not.toContain('Vào trận');

    for (const m of [instant, legacy]) {
      const c = card(container, m);
      expect(c.textContent).not.toContain('Host duyệt');
      expect(buttonNames(c)).toContain('Vào trận');
      expect(buttonNames(c)).not.toContain('Xin vào');
    }
  });

  it('AC-3: "Xin vào" sends POST /join with no json body, shows the pending text and "Hủy yêu cầu", and joinedCount stays 4/10', async () => {
    mockApi({
      [`/api/matches/${approval.id}/join`]: () => detailOf(approval, { myRequest: 'PENDING' }),
    });
    const { container } = renderScreen();
    await waitFor(() => expect(card(container, approval)).not.toBeNull());

    fireEvent.click(within(card(container, approval)).getByRole('button', { name: 'Xin vào' }));

    expect(await within(card(container, approval)).findByText('Đã gửi yêu cầu. Chờ host duyệt')).toBeDefined();
    const a = card(container, approval);
    expect(callsTo(`/api/matches/${approval.id}/join`)).toHaveLength(1);
    expect(callsTo(`/api/matches/${approval.id}/join`)[0]![1]).toEqual({ method: 'POST' });
    expect(buttonNames(a)).toContain('Hủy yêu cầu');
    expect(buttonNames(a)).not.toContain('Xin vào');
    expect(a.textContent).toContain('4/10 suất');
    expect(a.textContent).not.toContain('Bạn đã vào');
    expect(buttonNames(a)).not.toContain('Rời trận');
  });

  it('AC-4: "Hủy yêu cầu" sends POST /leave and the card returns to "Xin vào"', async () => {
    mockApi({
      [`/api/matches/${approval.id}/join`]: () => detailOf(approval, { myRequest: 'PENDING' }),
      [`/api/matches/${approval.id}/leave`]: () => detailOf(approval, { myRequest: null }),
    });
    const { container } = renderScreen();
    await waitFor(() => expect(card(container, approval)).not.toBeNull());
    fireEvent.click(within(card(container, approval)).getByRole('button', { name: 'Xin vào' }));
    fireEvent.click(await within(card(container, approval)).findByRole('button', { name: 'Hủy yêu cầu' }));

    await waitFor(() => expect(buttonNames(card(container, approval))).toContain('Xin vào'));
    expect(callsTo(`/api/matches/${approval.id}/leave`)).toHaveLength(1);
    expect(callsTo(`/api/matches/${approval.id}/leave`)[0]![1]).toEqual({ method: 'POST' });
    expect(card(container, approval).textContent).not.toContain('Chờ host duyệt');
    expect(card(container, approval).textContent).toContain('4/10 suất');
  });

  it('AC-5: a detail with myRequest "REJECTED" shows the rejection text and no "Xin vào"', async () => {
    mockApi({
      [`/api/matches/${approval.id}`]: () => detailOf(approval, { myRequest: 'REJECTED' }),
    });
    const { container } = renderScreen();
    await waitFor(() => expect(card(container, approval)).not.toBeNull());

    fireEvent.click(within(card(container, approval)).getByRole('button', { name: /^Chi tiết/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Chi tiết trận' });
    expect(await within(dialog).findByText('Host đã từ chối yêu cầu của bạn')).toBeDefined();
    expect(within(dialog).queryByRole('button', { name: 'Xin vào' })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'Hủy yêu cầu' })).toBeNull();
    // The card behind the sheet shows the same state.
    expect(buttonNames(card(container, approval))).not.toContain('Xin vào');
  });

  it('AC-5: a 409 "Host đã từ chối yêu cầu của bạn" on join shows the exact API text once and removes "Xin vào"', async () => {
    mockApi({
      [`/api/matches/${approval.id}/join`]: () => {
        throw new ApiError(409, 'Host đã từ chối yêu cầu của bạn');
      },
    });
    const { container } = renderScreen();
    await waitFor(() => expect(card(container, approval)).not.toBeNull());

    fireEvent.click(within(card(container, approval)).getByRole('button', { name: 'Xin vào' }));
    const text = await within(card(container, approval)).findByRole('alert');
    expect(text.textContent).toBe('Host đã từ chối yêu cầu của bạn');
    expect(within(card(container, approval)).getAllByText('Host đã từ chối yêu cầu của bạn')).toHaveLength(1);
    await waitFor(() => expect(buttonNames(card(container, approval))).not.toContain('Xin vào'));
  });

  it('AC-3: the detail sheet of a "Host duyệt" match offers "Xin vào" and then "Hủy yêu cầu"', async () => {
    mockApi({
      [`/api/matches/${approval.id}`]: () => detailOf(approval),
      [`/api/matches/${approval.id}/join`]: () => detailOf(approval, { myRequest: 'PENDING' }),
    });
    const { container } = renderScreen();
    await waitFor(() => expect(card(container, approval)).not.toBeNull());

    fireEvent.click(within(card(container, approval)).getByRole('button', { name: /^Chi tiết/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Chi tiết trận' });
    expect(within(dialog).queryByRole('button', { name: 'Vào trận' })).toBeNull();
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Xin vào' }));
    expect(await within(dialog).findByRole('button', { name: 'Hủy yêu cầu' })).toBeDefined();
    expect(within(dialog).getByText('Đã gửi yêu cầu. Chờ host duyệt')).toBeDefined();
    expect(within(dialog).getByText(/4\/10 suất/)).toBeDefined();
  });

  it('AC-4: a 409 on "Hủy yêu cầu" reads the detail and the card shows the rejection', async () => {
    mockApi({
      [`/api/matches/${approval.id}`]: () => detailOf(approval, { myRequest: 'REJECTED' }),
      [`/api/matches/${approval.id}/join`]: () => detailOf(approval, { myRequest: 'PENDING' }),
      [`/api/matches/${approval.id}/leave`]: () => {
        throw new ApiError(409, 'Bạn không ở trong trận');
      },
    });
    const { container } = renderScreen();
    await waitFor(() => expect(card(container, approval)).not.toBeNull());
    fireEvent.click(within(card(container, approval)).getByRole('button', { name: 'Xin vào' }));
    fireEvent.click(await within(card(container, approval)).findByRole('button', { name: 'Hủy yêu cầu' }));

    await waitFor(() => expect(buttonNames(card(container, approval))).not.toContain('Hủy yêu cầu'));
    expect(card(container, approval).textContent).toContain('Host đã từ chối yêu cầu của bạn');
    expect(buttonNames(card(container, approval))).not.toContain('Xin vào');
  });

  it('AC-4: a successful leave clears a stale PENDING request of that match', async () => {
    let left = false;
    api().mockImplementation(async (path: string) => {
      if (path === `/api/matches/${approval.id}`) return detailOf(approval, { viewerRole: 'PLAYER', myRequest: 'PENDING' });
      if (path === `/api/matches/${approval.id}/leave`) {
        left = true;
        return detailOf(approval, { myRequest: null });
      }
      if (path.startsWith('/api/matches/joined')) return left ? [] : [approval];
      if (path === '/api/matches') return [approval];
      throw new Error(`unexpected ${path}`);
    });
    const { container } = renderScreen();
    await waitFor(() => expect(buttonNames(card(container, approval))).toContain('Rời trận'));

    // The detail brings the stale PENDING into the cache.
    fireEvent.click(within(card(container, approval)).getByRole('button', { name: /^Chi tiết/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Chi tiết trận' });
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Rời trận' }));
    const leave = await screen.findByRole('dialog', { name: 'Rời trận này?' });
    fireEvent.click(within(leave).getByRole('button', { name: 'Rời trận' }));

    await waitFor(() => expect(buttonNames(card(container, approval))).toContain('Xin vào'));
    expect(buttonNames(card(container, approval))).not.toContain('Hủy yêu cầu');
  });

  it('AC-4: a slow refresh that started before a cancel does not put the cancelled request back', async () => {
    let releaseGet: (() => void) | undefined;
    let getCalls = 0;
    api().mockImplementation(async (path: string) => {
      if (path === `/api/matches/${approval.id}/join`) return detailOf(approval, { myRequest: 'PENDING' });
      if (path === `/api/matches/${approval.id}/leave`) return detailOf(approval, { myRequest: null });
      if (path === `/api/matches/${approval.id}`) {
        getCalls++;
        await new Promise<void>((resolve) => {
          releaseGet = resolve;
        });
        return detailOf(approval, { myRequest: 'PENDING' });
      }
      if (path.startsWith('/api/matches/joined')) return [];
      if (path === '/api/matches') return [approval];
      throw new Error(`unexpected ${path}`);
    });
    const { container } = renderScreen();
    await waitFor(() => expect(card(container, approval)).not.toBeNull());
    fireEvent.click(within(card(container, approval)).getByRole('button', { name: 'Xin vào' }));
    const cancel = await within(card(container, approval)).findByRole('button', { name: 'Hủy yêu cầu' });

    // A stream event starts a slow GET of the match.
    act(() => stream.onChange?.());
    await waitFor(() => expect(getCalls).toBe(1));
    fireEvent.click(cancel);
    await waitFor(() => expect(buttonNames(card(container, approval))).toContain('Xin vào'));

    // The old GET resolves with the stale PENDING.
    await act(async () => {
      releaseGet?.();
    });
    expect(buttonNames(card(container, approval))).toContain('Xin vào');
    expect(buttonNames(card(container, approval))).not.toContain('Hủy yêu cầu');
  });

  it('AC-2: the tap targets of the request buttons are at least 44px', async () => {
    mockApi({
      [`/api/matches/${approval.id}/join`]: () => detailOf(approval, { myRequest: 'PENDING' }),
    });
    const { container } = renderScreen();
    await waitFor(() => expect(card(container, approval)).not.toBeNull());
    const ask = within(card(container, approval)).getByRole('button', { name: 'Xin vào' });
    expect(ask.style.minHeight).toBe('44px');
    fireEvent.click(ask);
    const cancel = await within(card(container, approval)).findByRole('button', { name: 'Hủy yêu cầu' });
    expect(cancel.style.minHeight).toBe('44px');
  });
});
