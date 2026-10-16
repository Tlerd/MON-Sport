import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BookingForm } from './BookingForm.tsx';

const VENUE = {
  id: '0199a1b2-0000-7000-8000-000000000001', name: 'Cầu lông A', address: 'A', phone: '0912345678', opensAt: 360, closesAt: 1380,
  courts: [{ id: '0199a1b2-0000-7000-8000-000000000002', name: 'Sân 1', sport: 'BADMINTON', priceNormal: 80_000, pricePeak: 120_000 }],
};

describe('BookingForm', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('AC-20: a request for Sân 1, 16:30–18:00 on 20/11/2026 shows "Chờ xác nhận" and 160.000đ', async () => {
    const fetch = vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/venues') return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([VENUE]) });
      const body = JSON.parse(String(init?.body));
      return Promise.resolve({
        ok: true, status: 201,
        json: () => Promise.resolve({
          id: '0199a1b2-0000-7000-8000-000000000003', courtId: body.courtId, startAt: body.startAt, endAt: body.endAt,
          status: 'PENDING', source: 'APP', priceTotal: 160_000, confirmDeadline: null, confirmedAt: null, createdAt: body.startAt,
        }),
      });
    });
    vi.stubGlobal('fetch', fetch);
    render(<BookingForm />);

    fireEvent.change(await screen.findByLabelText('Đơn vị', {}, { timeout: 2000 }).then(async (el) => {
      await screen.findByRole('option', { name: 'Cầu lông A' });
      return el;
    }), { target: { value: VENUE.id } });
    fireEvent.change(screen.getByLabelText('Sân'), { target: { value: VENUE.courts[0].id } });
    fireEvent.change(screen.getByLabelText('Ngày'), { target: { value: '2026-11-20' } });
    fireEvent.change(screen.getByLabelText('Bắt đầu'), { target: { value: String(16 * 60 + 30) } });
    fireEvent.change(screen.getByLabelText('Thời lượng'), { target: { value: '90' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));

    expect(await screen.findByText('Chờ xác nhận')).toBeTruthy();
    expect(screen.getAllByText('160.000đ').length).toBeGreaterThan(0);
    const [, init] = fetch.mock.calls.find(([url]) => url === '/api/bookings')!;
    expect(JSON.parse(String(init!.body))).toMatchObject({ startAt: '2026-11-20T16:30:00+07:00', endAt: '2026-11-20T18:00:00+07:00' });
  });
});
