import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhoneBookings } from './PhoneBookings.tsx';

const COURT_1 = '0199a1b2-0000-7000-8000-000000000002';
const VENUE = {
  id: '0199a1b2-0000-7000-8000-000000000001', name: 'Cầu lông A', address: 'A', phone: '0912345678', opensAt: 360, closesAt: 1380,
  courts: [
    { id: COURT_1, name: 'Sân 1', sport: 'BADMINTON', priceNormal: 80_000, pricePeak: 120_000 },
    { id: '0199a1b2-0000-7000-8000-000000000004', name: 'Sân 2', sport: 'BADMINTON', priceNormal: 80_000, pricePeak: 120_000 },
  ],
};
const booking = (id: string, start: string, end: string, source: 'APP' | 'PHONE', customer: { name: string; phone: string | null }) => ({
  id: `0199a1b2-0000-7000-8000-00000000010${id}`, courtId: COURT_1, startAt: start, endAt: end, status: 'CONFIRMED', source,
  priceTotal: 120_000, confirmDeadline: null, confirmedAt: '2026-11-20T03:00:00.000Z', cancelledAt: null, createdAt: '2026-11-20T03:00:00.000Z', customer,
});

type Reply = [number, unknown];
/** A fetch stub: GET answers from the table, POST answers with the reply function. */
function stubApi(list: unknown[], post: (url: string, body: Record<string, unknown> | undefined) => Reply) {
  const fetch = vi.fn((url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const [status, json]: Reply = init?.method === 'POST' ? post(url, body) : url === '/api/owner/venues' ? [200, [VENUE]] : [200, list];
    return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(json) });
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

async function fillForm(name = '', phone = '') {
  const court = await screen.findByLabelText('Sân');
  await screen.findByRole('option', { name: 'Cầu lông A · Sân 1' });
  fireEvent.change(court, { target: { value: COURT_1 } });
  expect((screen.getByLabelText('Ngày') as HTMLInputElement).value).toBe('2026-11-20');
  fireEvent.change(screen.getByLabelText('Bắt đầu'), { target: { value: String(17 * 60) } });
  fireEvent.change(screen.getByLabelText('Thời lượng'), { target: { value: '60' } });
  fireEvent.change(screen.getByLabelText('Tên khách (không bắt buộc)'), { target: { value: name } });
  fireEvent.change(screen.getByLabelText('Số điện thoại khách (không bắt buộc)'), { target: { value: phone } });
}

const created = (body: Record<string, unknown> | undefined): Reply => [
  201,
  { ...booking('9', '2026-11-20T10:00:00.000Z', '2026-11-20T11:00:00.000Z', 'PHONE', { name: String(body?.customerName ?? ''), phone: (body?.customerPhone as string) ?? null }) },
];
const confirmedList = () => screen.getByRole('region', { name: 'Booking đã xác nhận' });

describe('PhoneBookings', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-20T10:00:00+07:00'));
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('AC-15: Bình enters Sân 1, 17:00–18:00 for "Chú Tư", sees 120.000đ first, and the list shows the booking', async () => {
    const fetch = stubApi([], (_url, body) => created(body));
    render(<PhoneBookings />);
    await fillForm('Chú Tư', '0987654321');
    // Only slots after 10:00 today are listed.
    expect(screen.queryByRole('option', { name: '10:00' })).toBeNull();
    expect(screen.getByRole('option', { name: '10:30' })).toBeTruthy();
    expect(screen.getByText('120.000đ')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Lưu booking' }));

    expect(await within(confirmedList()).findByText('Chú Tư')).toBeTruthy();
    const [, init] = fetch.mock.calls.find(([url, i]) => url === '/api/owner/bookings' && i?.method === 'POST')!;
    expect(JSON.parse(String(init!.body))).toEqual({
      courtId: COURT_1, startAt: '2026-11-20T17:00:00+07:00', endAt: '2026-11-20T18:00:00+07:00', customerName: 'Chú Tư', customerPhone: '0987654321',
    });
    expect(fetch).toHaveBeenCalledWith('/api/owner/bookings?status=CONFIRMED', expect.anything());
  });

  it('AC-16: with empty name and phone, the body has neither key and the list shows "Khách gọi điện" without a tel: link', async () => {
    const fetch = stubApi([], (_url, body) => created(body));
    render(<PhoneBookings />);
    await fillForm('  ', '');
    fireEvent.click(screen.getByRole('button', { name: 'Lưu booking' }));

    expect(await within(confirmedList()).findByText('Khách gọi điện')).toBeTruthy();
    const [, init] = fetch.mock.calls.find(([url, i]) => url === '/api/owner/bookings' && i?.method === 'POST')!;
    const body = JSON.parse(String(init!.body));
    expect('customerName' in body).toBe(false);
    expect('customerPhone' in body).toBe(false);
    expect(confirmedList().querySelector('a[href^="tel:"]')).toBeNull();
  });

  it('AC-17: a 409 shows "Khung giờ này vừa có người đặt" as an alert, and the boxes keep their values', async () => {
    stubApi([], () => [409, { message: 'Khung giờ này vừa có người đặt' }]);
    render(<PhoneBookings />);
    await fillForm('Chú Tư', '0987654321');
    fireEvent.click(screen.getByRole('button', { name: 'Lưu booking' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Khung giờ này vừa có người đặt');
    expect((screen.getByLabelText('Sân') as HTMLSelectElement).value).toBe(COURT_1);
    expect((screen.getByLabelText('Bắt đầu') as HTMLSelectElement).value).toBe(String(17 * 60));
    expect((screen.getByLabelText('Tên khách (không bắt buộc)') as HTMLInputElement).value).toBe('Chú Tư');
    expect((screen.getByLabelText('Số điện thoại khách (không bắt buộc)') as HTMLInputElement).value).toBe('0987654321');
  });

  it('AC-18: only the future PHONE booking has "Hủy", the ended one is hidden, and a cancelled row stays as "Đã hủy"', async () => {
    const phone = booking('1', '2026-11-20T10:00:00.000Z', '2026-11-20T11:00:00.000Z', 'PHONE', { name: 'Chú Tư', phone: '0987654321' });
    const app = booking('2', '2026-11-20T11:00:00.000Z', '2026-11-20T12:00:00.000Z', 'APP', { name: 'An', phone: '0901234567' });
    const ended = booking('3', '2026-11-20T01:00:00.000Z', '2026-11-20T02:00:00.000Z', 'PHONE', { name: 'Chú Ba', phone: null });
    const fetch = stubApi([ended, app, phone], () => [200, { ...phone, customer: undefined, status: 'CANCELLED', cancelledAt: '2026-11-20T03:00:00.000Z' }]);
    render(<PhoneBookings />);

    expect(await within(confirmedList()).findByText('Chú Tư')).toBeTruthy();
    expect(within(confirmedList()).queryByText('Chú Ba')).toBeNull();
    expect(within(confirmedList()).getAllByRole('listitem')).toHaveLength(2);
    expect(within(confirmedList()).getAllByRole('button', { name: 'Hủy' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(fetch.mock.calls.some(([, i]) => i?.method === 'POST')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận hủy' }));

    expect(await within(confirmedList()).findByText('Đã hủy')).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith(`/api/owner/bookings/${phone.id}/cancel`, expect.objectContaining({ method: 'POST' }));
    expect(within(confirmedList()).getByText('Chú Tư')).toBeTruthy();
    expect(within(confirmedList()).queryByRole('button', { name: 'Hủy' })).toBeNull();
  });
});
