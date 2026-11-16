import type { MatchView } from '@monsport/shared';
import { cleanup, render, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MatchCardContent, formatPriceK, stubDay } from './MatchCard.tsx';

const match: MatchView = {
  id: '0199a1b2-0000-7000-8000-000000000301',
  bookingId: '0199a1b2-0000-7000-8000-000000000201',
  hostId: '0199a1b2-0000-7000-8000-000000000101',
  hostName: 'Nguyễn Văn An',
  sport: 'BADMINTON',
  capacity: 4,
  joinedCount: 3,
  pricePerSlot: 45_000,
  status: 'OPEN',
  bookingStatus: 'CONFIRMED',
  startAt: '2026-11-20T13:00:00.000Z',
  endAt: '2026-11-20T14:00:00.000Z',
  courtName: 'Sân 1',
  venueName: 'Cầu lông A',
  venueAddress: '10 Nguyễn Huệ',
  createdAt: '2026-11-20T03:00:00.000Z',
  hostSkillLevel: 'INTERMEDIATE',
};

function renderCard(m: MatchView) {
  const { container } = render(
    <article className="mc">
      <MatchCardContent match={m} footerAction={<button type="button" className="btn sm lime">Xem chi tiết</button>} />
    </article>,
  );
  return container.querySelector('.mc') as HTMLElement;
}

describe('MatchCard (F-034)', () => {
  afterEach(cleanup);

  it('AC-4: the stub shows the court art, the big time, the day, and the sport label', () => {
    const card = renderCard(match);
    const stub = card.querySelector('.stub') as HTMLElement;
    expect(stub.querySelector('svg.court')).toBeTruthy();
    expect(stub.querySelector('.stub-when b')?.textContent).toBe('20:00');
    expect(within(stub).getByText('Cầu lông')).toBeTruthy();
    expect(stub.querySelector('.stub-when span')?.textContent).toMatch(/^(Hôm nay|Ngày mai|(CN|T[2-7]), \d{2}\/\d{2})$/);
  });

  it('AC-4: the body shows the type chip, the slots-left chip, the level chip, the title, and the location line with a pin', () => {
    const card = renderCard(match);
    const tags = card.querySelector('.tags') as HTMLElement;
    expect(within(tags).getByText('Trận đơn')).toBeTruthy();
    expect(within(tags).getByText('Thiếu 1')).toBeTruthy();
    expect(within(tags).getByText('Trình độ: Trung bình')).toBeTruthy();
    expect(card.querySelector('h3')?.textContent).toBe('Cầu lông A · Sân 1');
    expect(card.querySelector('.meta svg')).toBeTruthy();
  });

  it('AC-4: the footer shows an avatar stack with dashed empty seats, the price, and the action button', () => {
    const card = renderCard(match);
    const footer = card.querySelector('.mc-f') as HTMLElement;
    const stack = within(footer).getByRole('img', { name: '3/4 suất' });
    expect(stack.querySelectorAll('.av:not(.hole):not(.more)')).toHaveLength(3);
    expect(stack.querySelectorAll('.av.hole')).toHaveLength(1);
    expect(stack.querySelector('.av')?.textContent).toBe('A');
    expect(footer.querySelector('.fee')?.textContent).toBe('45k/suất');
    expect(footer.lastElementChild?.textContent).toBe('Xem chi tiết');
    expect(footer.lastElementChild?.className).toContain('lime');
  });

  it('AC-4: a match with 3 or more seats left shows "Còn n chỗ", and a full match shows "Đầy" and no empty seat', () => {
    const open = renderCard({ ...match, joinedCount: 1 });
    expect(within(open).getByText('Còn 3 chỗ')).toBeTruthy();
    cleanup();
    const full = renderCard({ ...match, joinedCount: 4, status: 'FULL' });
    expect(within(full).getByText('Đầy')).toBeTruthy();
    expect(full.querySelector('.slots-left')).toBeNull();
    expect(full.querySelectorAll('.av.hole')).toHaveLength(0);
  });

  it('AC-4: stubDay says "Hôm nay", "Ngày mai", or weekday and date', () => {
    const now = new Date('2026-11-20T05:00:00.000Z');
    expect(stubDay('2026-11-20T13:00:00.000Z', now)).toBe('Hôm nay');
    expect(stubDay('2026-11-21T01:00:00.000Z', now)).toBe('Ngày mai');
    expect(stubDay('2026-11-23T01:00:00.000Z', now)).toBe('T2, 23/11');
    expect(stubDay('2026-11-22T01:00:00.000Z', now)).toBe('CN, 22/11');
  });

  it('AC-4: formatPriceK shortens round amounts', () => {
    expect(formatPriceK(45_000)).toBe('45k');
    expect(formatPriceK(45_500)).toBe('45.500đ');
    expect(formatPriceK(0)).toBe('0đ');
  });
});
