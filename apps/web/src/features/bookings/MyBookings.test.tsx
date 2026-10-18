import { CALL_OWNER_MESSAGE } from '@monsport/shared';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MyBookings } from './MyBookings.tsx';

// Now is 20/11/2026 10:00 in Asia/Ho_Chi_Minh, as in the brief.
const row = (n: number, status: string, start: string, end: string, extra: Record<string, unknown> = {}) => ({
  id: `0199a1b2-0000-7000-8000-00000000020${n}`, courtId: '0199a1b2-0000-7000-8000-000000000002', startAt: start, endAt: end, status, source: 'APP',
  priceTotal: 120_000, confirmDeadline: null, confirmedAt: null, cancelledAt: null, createdAt: '2026-11-20T01:00:00.000Z',
  courtName: 'Sân 1', venueName: 'Cầu lông A', venuePhone: '0911111111', ...extra,
});
const pending = row(1, 'PENDING', '2026-11-20T05:00:00.000Z', '2026-11-20T06:00:00.000Z');
const sevenHours = row(2, 'CONFIRMED', '2026-11-20T10:00:00.000Z', '2026-11-20T11:00:00.000Z');
const fiveHours = row(3, 'CONFIRMED', '2026-11-20T08:00:00.000Z', '2026-11-20T09:00:00.000Z');
const rejected = row(4, 'REJECTED', '2026-11-20T10:00:00.000Z', '2026-11-20T11:00:00.000Z');
const expired = row(5, 'EXPIRED', '2026-11-20T10:00:00.000Z', '2026-11-20T11:00:00.000Z');
const cancelled = row(6, 'CANCELLED', '2026-11-20T10:00:00.000Z', '2026-11-20T11:00:00.000Z', { cancelledAt: '2026-11-20T02:00:00.000Z' });
const started = row(7, 'CONFIRMED', '2026-11-20T02:00:00.000Z', '2026-11-20T03:30:00.000Z');

type Reply = [number, unknown];
/** A fetch stub: GET answers with the next list, POST answers with the reply function. */
function stubApi(lists: unknown[][], post: (url: string) => Reply = () => [200, {}]) {
  const fetch = vi.fn((url: string, init?: RequestInit) => {
    const [status, json]: Reply = init?.method === 'POST' ? post(url) : [200, lists.length > 1 ? lists.shift() : lists[0]];
    return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(json) });
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
const rowOf = (text: string) => screen.getByText(text).closest('li')!;

describe('MyBookings', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-20T10:00:00+07:00'));
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('AC-15: each row shows venue · court, day, time, price and the status label, in API order', async () => {
    stubApi([[cancelled, pending, sevenHours, rejected, expired]]);
    render(<MyBookings />);

    expect(await screen.findAllByText('Cầu lông A · Sân 1')).toHaveLength(5);
    const items = screen.getAllByRole('listitem');
    expect(items.map((li) => li.getAttribute('data-status'))).toEqual(['CANCELLED', 'PENDING', 'CONFIRMED', 'REJECTED', 'EXPIRED']);
    expect(items.map((li) => li.querySelector('.status')?.textContent)).toEqual(['Đã hủy', 'Chờ xác nhận', 'Đã xác nhận', 'Bị từ chối', 'Hết hạn']);
    expect(within(items[1]).getByText('Ngày 20/11/2026')).toBeTruthy();
    expect(within(items[1]).getByText('12:00')).toBeTruthy();
    expect(within(items[1]).getByText('120.000đ')).toBeTruthy();
  });

  it('AC-15: an empty list shows "Bạn chưa có booking nào"', async () => {
    stubApi([[]]);
    render(<MyBookings />);
    expect((await screen.findByText(/^Bạn chưa có booking nào/)).textContent).toContain('Bạn chưa có booking nào');
  });

  it('AC-16: "Hủy" asks first, "Giữ booking" backs out with no call, "Xác nhận hủy" cancels in place and moves focus to the label', async () => {
    const fetch = stubApi([[pending, sevenHours]], () => [200, { ...sevenHours, status: 'CANCELLED', cancelledAt: '2026-11-20T03:00:00.000Z' }]);
    render(<MyBookings />);
    await screen.findAllByText('Cầu lông A · Sân 1');

    // The pending row is not cancellable by this test; the confirmed row with 7 hours left is.
    fireEvent.click(within(rowOf('17:00')).getByRole('button', { name: /^Hủy/ }));
    expect(screen.getByRole('button', { name: /^Xác nhận hủy/ })).toBeTruthy();
    expect(fetch.mock.calls.some(([, i]) => i?.method === 'POST')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Giữ booking' }));
    expect(document.activeElement?.textContent).toBe('Hủy');
    expect(fetch.mock.calls.some(([, i]) => i?.method === 'POST')).toBe(false);

    fireEvent.click(within(rowOf('17:00')).getByRole('button', { name: /^Hủy/ }));
    const confirm = screen.getByRole('button', { name: /^Xác nhận hủy/ });
    expect(document.activeElement).toBe(confirm);
    fireEvent.click(confirm);

    const item = rowOf('17:00');
    await vi.waitFor(() => expect(item.querySelector('.status')?.textContent).toBe('Đã hủy'));
    await vi.waitFor(() => expect(document.activeElement?.textContent).toBe('Đã hủy'));
    expect(fetch).toHaveBeenCalledWith(`/api/bookings/${sevenHours.id}/cancel`, expect.objectContaining({ method: 'POST' }));
    expect(item.getAttribute('data-status')).toBe('CANCELLED');
    expect(within(item).queryByRole('button')).toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('AC-17: with under 6 hours left the row shows the message and a "Gọi chủ sân" link, and no other row has either', async () => {
    stubApi([[fiveHours, rejected, expired, cancelled, started]]);
    render(<MyBookings />);
    await screen.findAllByText('Cầu lông A · Sân 1');

    expect(screen.queryByRole('button', { name: /^Hủy/ })).toBeNull();
    expect(screen.getAllByText(CALL_OWNER_MESSAGE)).toHaveLength(1);
    const links = screen.getAllByRole('link', { name: 'Gọi chủ sân' });
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe('tel:0911111111');
    expect(within(rowOf(CALL_OWNER_MESSAGE)).getByText('15:00')).toBeTruthy();
  });

  it('AC-18: a 409 on cancel shows the message as an alert and reloads the list from the server', async () => {
    const fetch = stubApi([[sevenHours], [{ ...sevenHours, status: 'CANCELLED', cancelledAt: '2026-11-20T02:59:00.000Z' }]], () => [409, { message: 'Booking này không hủy được nữa' }]);
    render(<MyBookings />);
    await screen.findByText('Cầu lông A · Sân 1');

    fireEvent.click(screen.getByRole('button', { name: /^Hủy/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Xác nhận hủy/ }));

    expect((await screen.findByRole('alert')).textContent).toBe('Booking này không hủy được nữa');
    await vi.waitFor(() => expect(screen.getByRole('listitem').getAttribute('data-status')).toBe('CANCELLED'));
    expect(fetch.mock.calls.filter(([url, i]) => url === '/api/bookings/mine' && !i?.method)).toHaveLength(2);
  });
});
