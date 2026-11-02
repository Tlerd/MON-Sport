import { cleanup, fireEvent, render } from '@testing-library/react';
import type { LobbyCard } from '@monsport/client';
import type { MatchView } from '@monsport/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LobbyMatchCard } from './LobbyMatchCard';

const match = {
  id: '00000000-0000-4000-8000-000000000001',
  bookingId: '00000000-0000-4000-8000-0000000000b1',
  hostId: '00000000-0000-4000-8000-0000000000a1',
  hostName: 'Host A',
  sport: 'BADMINTON',
  capacity: 10,
  joinedCount: 4,
  pricePerSlot: 40_000,
  status: 'OPEN',
  bookingStatus: 'CONFIRMED',
  startAt: '2026-11-03T20:00:00+07:00',
  endAt: '2026-11-03T21:00:00+07:00',
  courtName: 'Sân 1',
  venueName: 'Đơn vị rất dài '.repeat(5),
  venueAddress: 'Địa chỉ',
  createdAt: '2026-11-01T10:00:00+07:00',
} as MatchView;

const make = (over: { match?: Partial<MatchView>; joined?: boolean; isHost?: boolean } = {}): LobbyCard => ({
  match: { ...match, ...over.match } as MatchView,
  joined: over.joined ?? false,
  isHost: over.isHost ?? false,
});

describe('LobbyMatchCard', () => {
  afterEach(cleanup);

  it('AC-1: shows the labels, the id attribute, and a "Vào trận" button that calls onJoin', () => {
    const onJoin = vi.fn();
    const { container } = render(<LobbyMatchCard card={make()} onJoin={onJoin} />);
    const article = container.querySelector('article')!;
    expect(article.getAttribute('data-match-id')).toBe(match.id);
    expect(article.textContent).toContain('4/10 suất');
    expect(article.textContent).toContain('40.000đ/suất');
    fireEvent.click(article.querySelector('button')!);
    expect(onJoin).toHaveBeenCalledWith(expect.objectContaining({ id: match.id }));
  });

  it('AC-1: FULL, joined, and host cards have no join button and show their labels', () => {
    const full = render(<LobbyMatchCard card={make({ match: { status: 'FULL' }, joined: true })} />);
    expect(full.container.querySelector('button')).toBeNull();
    expect(full.container.textContent).toContain('Đầy');
    expect(full.container.textContent).toContain('Bạn đã vào');
    cleanup();
    const host = render(<LobbyMatchCard card={make({ joined: true, isHost: true })} />);
    expect(host.container.querySelector('button')).toBeNull();
    expect(host.container.textContent).toContain('Bạn là host');
    expect(host.container.textContent).not.toContain('Bạn đã vào');
  });

  it('AC-16: the card wraps long text and avoids overflow', () => {
    const { container } = render(<LobbyMatchCard card={make()} />);
    const article = container.querySelector('article')!;
    expect(['0', '0px']).toContain(article.style.minWidth);
    expect(article.querySelector<HTMLElement>('span')!.style.overflowWrap).toBe('anywhere');
    expect(container.textContent).not.toMatch(/\d{9,}/);
  });
});
