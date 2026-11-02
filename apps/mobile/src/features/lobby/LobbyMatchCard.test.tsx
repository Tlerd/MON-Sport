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

  it('AC-12: a host card shows "Hủy trận" only while userCancelDecision is ALLOW (BR-11)', () => {
    const buttons = (c: HTMLElement) => [...c.querySelectorAll('button')].map((b) => b.textContent);
    const at = (iso: string) => new Date(iso);
    const host = (over: Partial<MatchView>) => make({ isHost: true, joined: true, match: over });
    const startAt = '2026-11-02T16:00:00+07:00';
    const endAt = '2026-11-02T17:00:00+07:00';

    // CONFIRMED, exactly 6 h before the start: still ALLOW.
    const six = render(
      <LobbyMatchCard
        card={host({ bookingStatus: 'CONFIRMED', startAt, endAt })}
        now={at('2026-11-02T10:00:00+07:00')}
      />,
    );
    expect(buttons(six.container)).toContain('Hủy trận');
    six.unmount();

    // CONFIRMED, 5 h before the start: CALL_OWNER. The server would answer 409, so no button, and a hint.
    const five = render(
      <LobbyMatchCard
        card={host({ bookingStatus: 'CONFIRMED', startAt, endAt })}
        now={at('2026-11-02T11:00:00+07:00')}
      />,
    );
    expect(buttons(five.container)).not.toContain('Hủy trận');
    expect(five.container.textContent).toContain('Còn dưới 6 giờ');
    expect(five.container.textContent).toContain('Lịch của tôi');
    five.unmount();

    // PENDING, 1 h before the start: ALLOW.
    const pending = render(
      <LobbyMatchCard
        card={host({ bookingStatus: 'PENDING', startAt, endAt })}
        now={at('2026-11-02T15:00:00+07:00')}
      />,
    );
    expect(buttons(pending.container)).toContain('Hủy trận');
  });

  it('AC-1: FULL, joined, and host cards have no join button and show their labels', () => {
    const full = render(<LobbyMatchCard card={make({ match: { status: 'FULL' }, joined: true })} />);
    const fullButtons = [...full.container.querySelectorAll('button')].map((b) => b.textContent);
    expect(fullButtons).not.toContain('Vào trận');
    expect(fullButtons).toEqual(['Rời trận', 'Chi tiết']);
    expect(full.container.textContent).toContain('Đầy');
    expect(full.container.textContent).toContain('Bạn đã vào');
    cleanup();
    const host = render(
      <LobbyMatchCard
        card={make({ joined: true, isHost: true })}
        now={new Date('2026-11-02T10:00:00+07:00')}
      />,
    );
    const hostButtons = [...host.container.querySelectorAll('button')].map((b) => b.textContent);
    expect(hostButtons).not.toContain('Vào trận');
    expect(hostButtons).not.toContain('Rời trận');
    expect(hostButtons).toEqual(['Hủy trận', 'Chi tiết']);
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
