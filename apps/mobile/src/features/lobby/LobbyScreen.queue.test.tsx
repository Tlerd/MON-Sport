import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as clientModule from '@monsport/client';
import { ApiError } from '@monsport/client';
import type { MatchDetailView, MatchRequestView, MatchView } from '@monsport/shared';
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

const HOST_ID = '00000000-0000-4000-8000-0000000000a1';
const LAN = '00000000-0000-4000-8000-0000000000c1';
const MINH = '00000000-0000-4000-8000-0000000000c2';
const now = new Date('2026-11-02T10:00:00+07:00');

const approval = {
  id: '00000000-0000-4000-8000-000000000002',
  bookingId: '00000000-0000-4000-8000-0000000000b1',
  hostId: HOST_ID,
  hostName: 'Host',
  sport: 'BADMINTON',
  capacity: 10,
  joinedCount: 4,
  pricePerSlot: 40_000,
  status: 'OPEN',
  bookingStatus: 'CONFIRMED',
  joinMode: 'APPROVAL',
  startAt: '2026-11-04T20:00:00+07:00',
  endAt: '2026-11-04T21:00:00+07:00',
  courtName: 'Sân 2',
  venueName: 'Đơn vị 2',
  venueAddress: 'Địa chỉ',
  createdAt: '2026-11-01T10:00:00+07:00',
} as MatchView;

const lan = { userId: LAN, name: 'Lan', phone: '0911111111', requestedAt: '2026-11-02T09:00:00+07:00' } as MatchRequestView;
const minh = { userId: MINH, name: 'Minh', phone: '0922222222', requestedAt: '2026-11-02T09:05:00+07:00' } as MatchRequestView;

const detailOf = (over: Partial<MatchDetailView> = {}): MatchDetailView =>
  ({ ...approval, viewerRole: 'HOST', players: [], ...over }) as MatchDetailView;

const api = () => vi.mocked(clientModule.api);
const callsTo = (path: string) => api().mock.calls.filter(([p]) => p === path);
const detailPath = `/api/matches/${approval.id}`;
const reqPath = `${detailPath}/requests`;

function renderScreen(userId = HOST_ID) {
  vi.spyOn(sessionModule, 'useSession').mockReturnValue({
    user: { id: userId, name: 'Host', role: 'USER' } as sessionModule.SessionContextType['user'],
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

function mockApi(handlers: Record<string, (init?: unknown) => unknown>) {
  api().mockImplementation(async (path: string, init?: unknown) => {
    const handler = handlers[path];
    if (handler) return handler(init);
    if (path.startsWith('/api/matches/joined')) return [];
    if (path === '/api/matches') return [approval];
    throw new Error(`unexpected ${path}`);
  });
}

async function openSheet(container: HTMLElement) {
  await waitFor(() => expect(container.querySelector(`[data-match-id="${approval.id}"]`)).not.toBeNull());
  const c = container.querySelector<HTMLElement>(`[data-match-id="${approval.id}"]`)!;
  fireEvent.click(within(c).getByRole('button', { name: /^Chi tiết/ }));
  return screen.findByRole('dialog', { name: 'Chi tiết trận' });
}

describe('LobbyScreen: host queue (F-035 step 2)', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    api().mockReset();
    stream.onChange = undefined;
  });

  it('AC-6: the host sheet of a "Host duyệt" match loads the queue and shows "Hàng chờ (2)" with name, tel link, "Duyệt" and "Từ chối"', async () => {
    mockApi({ [detailPath]: () => detailOf(), [reqPath]: () => [lan, minh] });
    const { container } = renderScreen();
    const dialog = await openSheet(container);

    expect(await within(dialog).findByText('Hàng chờ (2)')).toBeDefined();
    expect(callsTo(reqPath)).toHaveLength(1);
    const link = within(dialog).getByRole('link', { name: '0911111111' });
    expect(link.getAttribute('href')).toBe('tel:0911111111');
    expect(within(dialog).getByText('Minh')).toBeDefined();
    expect(within(dialog).getAllByRole('button', { name: 'Duyệt' })).toHaveLength(2);
    expect(within(dialog).getAllByRole('button', { name: 'Từ chối' })).toHaveLength(2);
  });

  it('AC-6: a non-host never calls /requests and sees no phone (BR-20)', async () => {
    mockApi({
      [detailPath]: () => detailOf({ viewerRole: 'NONE', players: [{ userId: LAN, name: 'Lan' } as never] }),
      [reqPath]: () => {
        throw new Error('forbidden');
      },
    });
    const { container } = renderScreen('00000000-0000-4000-8000-0000000000a9');
    const dialog = await openSheet(container);

    expect(await within(dialog).findByText('Lan')).toBeDefined();
    expect(callsTo(reqPath)).toHaveLength(0);
    expect(within(dialog).queryByText(/Hàng chờ/)).toBeNull();
    expect(within(dialog).queryByRole('link')).toBeNull();
  });

  it('AC-7: "Duyệt" posts approve, Lan leaves the queue, and the players and joinedCount update; "Từ chối" posts reject', async () => {
    let approved = false;
    let queue = [lan, minh];
    mockApi({
      [detailPath]: () =>
        approved
          ? detailOf({ joinedCount: 5, players: [{ userId: LAN, name: 'Lan', phone: '0911111111' } as never] })
          : detailOf(),
      [reqPath]: () => queue,
      [`${reqPath}/${LAN}/approve`]: () => {
        approved = true;
        queue = [minh];
        return detailOf({ joinedCount: 5 });
      },
      [`${reqPath}/${MINH}/reject`]: () => {
        queue = [];
        return detailOf({ joinedCount: 5 });
      },
    });
    const { container } = renderScreen();
    const dialog = await openSheet(container);
    await within(dialog).findByText('Hàng chờ (2)');

    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Duyệt' })[0]!);
    expect(await within(dialog).findByText('Hàng chờ (1)')).toBeDefined();
    expect(callsTo(`${reqPath}/${LAN}/approve`)).toHaveLength(1);
    expect(callsTo(`${reqPath}/${LAN}/approve`)[0]![1]).toEqual({ method: 'POST' });
    await waitFor(() => expect(within(dialog).getByText(/5\/10 suất/)).toBeDefined());
    expect(within(dialog).queryByRole('button', { name: 'Duyệt' })).not.toBeNull();
    expect(within(dialog).getByRole('link', { name: '0911111111' })).toBeDefined();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Từ chối' }));
    expect(await within(dialog).findByText('Hàng chờ (0)')).toBeDefined();
    expect(callsTo(`${reqPath}/${MINH}/reject`)).toHaveLength(1);
  });

  it.each(['Trận đã đủ người', 'Yêu cầu này đã hết hạn'])(
    'AC-8: a 409 "%s" on approve shows the exact API text and reloads the detail and the queue',
    async (text) => {
      mockApi({
        [detailPath]: () => detailOf(),
        [reqPath]: () => [lan],
        [`${reqPath}/${LAN}/approve`]: () => {
          throw new ApiError(409, text);
        },
      });
      const { container } = renderScreen();
      const dialog = await openSheet(container);
      await within(dialog).findByText('Hàng chờ (1)');
      expect(callsTo(detailPath)).toHaveLength(1);

      fireEvent.click(within(dialog).getByRole('button', { name: 'Duyệt' }));
      const alert = await within(dialog).findByRole('alert');
      expect(alert.textContent).toBe(text);
      await waitFor(() => expect(callsTo(detailPath)).toHaveLength(2));
      await waitFor(() => expect(callsTo(reqPath)).toHaveLength(2));
      expect(within(dialog).getByRole('alert').textContent).toBe(text);
    },
  );

  it('AC-8: a double tap on "Duyệt" sends one request for that person', async () => {
    let release: (v: unknown) => void = () => undefined;
    mockApi({
      [detailPath]: () => detailOf(),
      [reqPath]: () => [lan],
      [`${reqPath}/${LAN}/approve`]: () => new Promise((r) => (release = r)),
    });
    const { container } = renderScreen();
    const dialog = await openSheet(container);
    const btn = await within(dialog).findByRole('button', { name: 'Duyệt' });

    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(callsTo(`${reqPath}/${LAN}/approve`)).toHaveLength(1);
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    await act(async () => release(detailOf()));
  });

  it('AC-8: a slow load that started before a decision does not bring the decided person back', async () => {
    let slow: (v: unknown) => void = () => undefined;
    let calls = 0;
    let queue = [lan];
    mockApi({
      [detailPath]: () => detailOf(),
      [reqPath]: () => {
        calls += 1;
        // The second load (from the stream) hangs and answers late with the old queue.
        return calls === 2 ? new Promise((r) => (slow = r)) : queue;
      },
      [`${reqPath}/${LAN}/reject`]: () => {
        queue = [];
        return detailOf();
      },
    });
    const { container } = renderScreen();
    const dialog = await openSheet(container);
    await within(dialog).findByText('Hàng chờ (1)');

    act(() => stream.onChange?.());
    await waitFor(() => expect(calls).toBe(2));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Từ chối' }));
    expect(await within(dialog).findByText('Hàng chờ (0)')).toBeDefined();
    await act(async () => slow([lan]));
    expect(within(dialog).getByText('Hàng chờ (0)')).toBeDefined();
  });

  it('AC-9: a stream event for the open match reloads the detail and the queue once', async () => {
    mockApi({ [detailPath]: () => detailOf(), [reqPath]: () => [lan] });
    const { container } = renderScreen();
    const dialog = await openSheet(container);
    await within(dialog).findByText('Hàng chờ (1)');
    expect(callsTo(detailPath)).toHaveLength(1);
    expect(callsTo(reqPath)).toHaveLength(1);

    act(() => stream.onChange?.());
    await waitFor(() => expect(callsTo(reqPath)).toHaveLength(2));
    expect(callsTo(detailPath)).toHaveLength(2);
    await new Promise((r) => setTimeout(r, 30));
    expect(callsTo(detailPath)).toHaveLength(2);
    expect(callsTo(reqPath)).toHaveLength(2);
  });

  it('AC-11: "Duyệt", "Từ chối" and the phone link are at least 44px tall', async () => {
    mockApi({ [detailPath]: () => detailOf(), [reqPath]: () => [lan] });
    const { container } = renderScreen();
    const dialog = await openSheet(container);
    expect((await within(dialog).findByRole('button', { name: 'Duyệt' })).style.minHeight).toBe('44px');
    expect(within(dialog).getByRole('button', { name: 'Từ chối' }).style.minHeight).toBe('44px');
    expect(within(dialog).getByRole('link', { name: '0911111111' }).style.minHeight).toBe('44px');
  });
});
