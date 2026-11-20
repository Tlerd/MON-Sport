import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as clientModule from '@monsport/client';
import type { MatchDetailView, MatchView } from '@monsport/shared';
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

const withLevel = makeMatch(1, { hostSkillLevel: 'INTERMEDIATE' });
const withoutLevel = makeMatch(2, { hostSkillLevel: null });

type User = sessionModule.SessionContextType['user'];
const player: User = { id: USER_ID, name: 'Người chơi', role: 'USER' } as User;

const api = () => vi.mocked(clientModule.api);
const feedCalls = () =>
  api()
    .mock.calls.map(([p]) => String(p))
    .filter((p) => p.split('?')[0] === '/api/matches');

function mockApi(feed: MatchView[], detail?: MatchDetailView) {
  api().mockImplementation(async (path: string) => {
    if (path.startsWith('/api/matches/joined')) return [];
    if (detail && path === `/api/matches/${detail.id}`) return detail;
    if (path.startsWith('/api/matches')) return feed;
    throw new Error(`unexpected ${path}`);
  });
}

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
        <Route path="/" element={<p>Trang chủ đặt sân</p>} />
        <Route path="/phong-cho" element={<LobbyScreen now={now} />} />
      </Routes>
    </MemoryRouter>,
  );
}

const chip = (name: string) => screen.getByRole('button', { name });
const card = (c: HTMLElement, m: MatchView) => c.querySelector<HTMLElement>(`[data-match-id="${m.id}"]`);

describe('LobbyScreen skill level, brief F-039', () => {
  beforeEach(() => {
    streamOnChange = undefined;
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    api().mockReset();
  });

  it('AC-4: the filter has "Mọi trình độ" selected and the three levels; the first request has no level', async () => {
    mockApi([withLevel]);
    renderScreen();
    await waitFor(() => expect(feedCalls().length).toBeGreaterThan(0));

    expect(chip('Mọi trình độ').getAttribute('aria-pressed')).toBe('true');
    for (const label of ['Mới chơi', 'Trung bình', 'Khá']) {
      expect(chip(label).getAttribute('aria-pressed')).toBe('false');
    }
    expect(feedCalls()[0]).toBe('/api/matches');
  });

  it('AC-5: choosing "Khá" requests level=ADVANCED, choosing it again drops level', async () => {
    mockApi([withLevel]);
    renderScreen();
    await waitFor(() => expect(feedCalls()).toHaveLength(1));

    fireEvent.click(chip('Khá'));
    await waitFor(() => expect(feedCalls().at(-1)).toBe('/api/matches?level=ADVANCED'));
    expect(chip('Khá').getAttribute('aria-pressed')).toBe('true');
    expect(chip('Mọi trình độ').getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(chip('Khá'));
    await waitFor(() => expect(feedCalls().at(-1)).toBe('/api/matches'));
    expect(chip('Mọi trình độ').getAttribute('aria-pressed')).toBe('true');
  });

  it('AC-6: a stream event reloads the lobby with level=ADVANCED still set', async () => {
    mockApi([withLevel]);
    renderScreen();
    await waitFor(() => expect(feedCalls()).toHaveLength(1));
    fireEvent.click(chip('Khá'));
    await waitFor(() => expect(feedCalls()).toHaveLength(2));

    await act(async () => {
      streamOnChange?.();
    });

    await waitFor(() => expect(feedCalls()).toHaveLength(3));
    expect(feedCalls().at(-1)).toBe('/api/matches?level=ADVANCED');
  });

  it('AC-7: the card shows "Trình độ: Trung bình" for a host with a level and no level label for null', async () => {
    mockApi([withLevel, withoutLevel]);
    const { container } = renderScreen();
    await waitFor(() => expect(card(container, withLevel)).not.toBeNull());

    expect(card(container, withLevel)?.textContent).toContain('Trình độ: Trung bình');
    expect(card(container, withoutLevel)?.textContent).not.toContain('Trình độ');
  });

  it.each([
    ['BEGINNER', 'Trình độ: Mới chơi'],
    [null, undefined],
  ] as const)('AC-8: the detail sheet with hostSkillLevel %s shows %s', async (hostSkillLevel, expected) => {
    const match = makeMatch(3, { hostSkillLevel });
    const detail: MatchDetailView = { ...match, viewerRole: 'NONE', players: [] };
    mockApi([match], detail);
    const { container } = renderScreen();
    await waitFor(() => expect(card(container, match)).not.toBeNull());
    fireEvent.click(card(container, match)!);

    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(dialog.textContent).toContain('Vào trận'));
    if (expected) expect(dialog.textContent).toContain(expected);
    else expect(dialog.textContent).not.toContain('Trình độ');
  });
});
