import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { formatDeadlineRemaining, SchedulePage } from './SchedulePage.tsx';

describe('SchedulePage (F-030)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-20T03:00:00Z'));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  const venue = {
    id: '0199a1b2-0000-7000-8000-000000000001',
    name: 'Cầu lông A',
    address: '123 Đường 3/2',
    phone: '0912345678',
    opensAt: 360,
    closesAt: 1380,
    courts: [
      {
        id: 'court-1',
        venueId: '0199a1b2-0000-7000-8000-000000000001',
        name: 'Sân 1',
        sport: 'BADMINTON' as const,
        priceNormal: 50_000,
        pricePeak: 70_000,
      },
    ],
  };

  const user = {
    id: '0199a1b2-0000-7000-8000-000000000002',
    name: 'Chủ sân',
    role: 'OWNER' as const,
  };

  function setupFetch(customHandler?: (url: string, opts?: RequestInit & { json?: any }) => Promise<any> | undefined) {
    const fetchMock = vi.fn((url: string, opts?: RequestInit & { json?: any }) => {
      if (customHandler) {
        const handled = customHandler(url, opts);
        if (handled) return handled;
      }
      if (url === '/api/auth/me') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(user) });
      }
      if (url === '/api/owner/venues') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([venue]) });
      }
      if (url === '/api/owner/bookings') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  function renderPage() {
    return render(
      <MemoryRouter initialEntries={['/']}>
        <SchedulePage />
      </MemoryRouter>,
    );
  }

  it('AC-9: form toggle, options 2-12, payload without recurring and with recurring', async () => {
    let capturedBookingRequest: any = null;
    let capturedRecurringRequest: any = null;

    setupFetch((url, opts) => {
      if (url === '/api/owner/bookings' && opts?.method === 'POST') {
        capturedBookingRequest = JSON.parse(opts.body as string);
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () =>
            Promise.resolve({
              id: '0199a1b2-0000-7000-8000-000000000010',
              courtId: 'court-1',
              startAt: '2026-11-20T06:00:00+07:00',
              endAt: '2026-11-20T07:00:00+07:00',
              status: 'CONFIRMED',
              source: 'PHONE',
              priceTotal: 50_000,
              customer: { name: 'Khách', phone: null },
            }),
        });
      }
      if (url === '/api/owner/bookings/recurring' && opts?.method === 'POST') {
        capturedRecurringRequest = JSON.parse(opts.body as string);
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () =>
            Promise.resolve({
              seriesId: '0199a1b2-0000-7000-8000-000000000099',
              created: [
                {
                  id: '0199a1b2-0000-7000-8000-000000000010',
                  courtId: 'court-1',
                  startAt: '2026-11-20T06:00:00+07:00',
                  endAt: '2026-11-20T07:00:00+07:00',
                  status: 'CONFIRMED',
                  source: 'PHONE',
                  priceTotal: 50_000,
                  customer: { name: 'Chú Năm', phone: '0987654321' },
                },
              ],
              skipped: [],
            }),
        });
      }
    });

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Lịch sân' })).toBeTruthy();

    const openBtn = await screen.findByRole('button', { name: /Booking khách gọi/ });
    fireEvent.click(openBtn);

    expect(await screen.findByRole('heading', { name: 'Booking khách gọi' })).toBeTruthy();

    const recurringCheckbox = screen.getByLabelText('Lặp lại hằng tuần') as HTMLInputElement;
    expect(recurringCheckbox).toBeTruthy();
    expect(recurringCheckbox.checked).toBe(false);

    expect(screen.queryByLabelText('Số tuần')).toBeNull();
    expect(screen.getByText('Tạm tính')).toBeTruthy();
    expect(screen.queryByText('Tạm tính mỗi buổi')).toBeNull();

    const submitBtn = screen.getByRole('button', { name: 'Lưu booking' });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/Đã lưu booking/)).toBeTruthy();
    expect(capturedBookingRequest).toEqual({
      courtId: 'court-1',
      startAt: '2026-11-20T06:00:00+07:00',
      endAt: '2026-11-20T07:00:00+07:00',
    });

    fireEvent.click(screen.getByRole('button', { name: /Booking khách gọi/ }));
    expect(await screen.findByRole('heading', { name: 'Booking khách gọi' })).toBeTruthy();

    const recurringCheckbox2 = screen.getByLabelText('Lặp lại hằng tuần') as HTMLInputElement;
    expect(recurringCheckbox2.checked).toBe(false);

    fireEvent.click(recurringCheckbox2);
    expect(recurringCheckbox2.checked).toBe(true);
    expect(screen.getByText('Tạm tính mỗi buổi')).toBeTruthy();
    expect(screen.queryByText('Tạm tính')).toBeNull();

    const weeksSelect = screen.getByLabelText('Số tuần') as HTMLSelectElement;
    expect(weeksSelect).toBeTruthy();

    expect(weeksSelect.value).toBe('4');

    const optionValues = Array.from(weeksSelect.options).map((opt) => Number(opt.value));
    expect(optionValues).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

    fireEvent.change(weeksSelect, { target: { value: '8' } });
    expect(weeksSelect.value).toBe('8');

    fireEvent.change(screen.getByPlaceholderText('Tên khách'), { target: { value: 'Chú Năm' } });
    fireEvent.change(screen.getByPlaceholderText('09...'), { target: { value: '0987654321' } });

    fireEvent.click(screen.getByRole('button', { name: 'Lưu booking' }));

    await screen.findByText(/Đã tạo/);
    expect(capturedRecurringRequest).toBeTruthy();
    expect(capturedRecurringRequest).toEqual({
      courtId: 'court-1',
      startAt: '2026-11-20T06:00:00+07:00',
      endAt: '2026-11-20T07:00:00+07:00',
      customerName: 'Chú Năm',
      customerPhone: '0987654321',
      weeks: 8,
    });
  });

  it('AC-10: success banner with created count and skipped dates, error handling', async () => {
    let mode: 'success-clean' | 'success-skipped' | 'conflict' = 'success-clean';
    let bookingsFetchCount = 0;

    setupFetch((url, opts) => {
      if (url === '/api/owner/bookings' && (!opts || opts.method === undefined || opts.method === 'GET')) {
        bookingsFetchCount++;
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
      }
      if (url === '/api/owner/bookings/recurring' && opts?.method === 'POST') {
        if (mode === 'conflict') {
          return Promise.resolve({
            ok: false,
            status: 409,
            json: () => Promise.resolve({ message: 'Mọi buổi đều đã có người đặt' }),
          });
        }
        if (mode === 'success-skipped') {
          return Promise.resolve({
            ok: true,
            status: 201,
            json: () =>
              Promise.resolve({
                seriesId: '0199a1b2-0000-7000-8000-000000000099',
                created: [
                  {
                    id: 'b-1',
                    courtId: 'court-1',
                    startAt: '2026-11-20T06:00:00+07:00',
                    endAt: '2026-11-20T07:00:00+07:00',
                    status: 'CONFIRMED',
                    source: 'PHONE',
                    priceTotal: 50_000,
                    customer: { name: 'Khách', phone: null },
                  },
                  {
                    id: 'b-2',
                    courtId: 'court-1',
                    startAt: '2026-12-04T06:00:00+07:00',
                    endAt: '2026-12-04T07:00:00+07:00',
                    status: 'CONFIRMED',
                    source: 'PHONE',
                    priceTotal: 50_000,
                    customer: { name: 'Khách', phone: null },
                  },
                  {
                    id: 'b-3',
                    courtId: 'court-1',
                    startAt: '2026-12-11T06:00:00+07:00',
                    endAt: '2026-12-11T07:00:00+07:00',
                    status: 'CONFIRMED',
                    source: 'PHONE',
                    priceTotal: 50_000,
                    customer: { name: 'Khách', phone: null },
                  },
                ],
                skipped: [
                  {
                    startAt: '2026-11-27T06:00:00+07:00',
                    endAt: '2026-11-27T07:00:00+07:00',
                  },
                ],
              }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () =>
            Promise.resolve({
              seriesId: '0199a1b2-0000-7000-8000-000000000099',
              created: [
                {
                  id: 'b-1',
                  courtId: 'court-1',
                  startAt: '2026-11-20T06:00:00+07:00',
                  endAt: '2026-11-20T07:00:00+07:00',
                  status: 'CONFIRMED',
                  source: 'PHONE',
                  priceTotal: 50_000,
                  customer: { name: 'Khách', phone: null },
                },
                {
                  id: 'b-2',
                  courtId: 'court-1',
                  startAt: '2026-11-27T06:00:00+07:00',
                  endAt: '2026-11-27T07:00:00+07:00',
                  status: 'CONFIRMED',
                  source: 'PHONE',
                  priceTotal: 50_000,
                  customer: { name: 'Khách', phone: null },
                },
              ],
              skipped: [],
            }),
        });
      }
    });

    renderPage();
    expect(await screen.findByRole('heading', { name: 'Lịch sân' })).toBeTruthy();
    const initialBookingLoads = bookingsFetchCount;

    mode = 'success-clean';
    fireEvent.click(screen.getByRole('button', { name: /Booking khách gọi/ }));
    fireEvent.click(screen.getByLabelText('Lặp lại hằng tuần'));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu booking' }));

    const statusClean = await screen.findByRole('status');
    expect(statusClean.textContent).toBe('Đã tạo 2 buổi');
    expect(statusClean.textContent).not.toContain('Bỏ qua');
    expect(bookingsFetchCount).toBeGreaterThan(initialBookingLoads);

    const beforeSkippedLoads = bookingsFetchCount;
    mode = 'success-skipped';
    fireEvent.click(screen.getByRole('button', { name: /Booking khách gọi/ }));
    fireEvent.click(screen.getByLabelText('Lặp lại hằng tuần'));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu booking' }));

    const statusSkipped = await screen.findByRole('status');
    expect(statusSkipped.textContent).toBe('Đã tạo 3 buổi. Bỏ qua 1 buổi trùng giờ: 27/11');
    expect(bookingsFetchCount).toBeGreaterThan(beforeSkippedLoads);

    mode = 'conflict';
    fireEvent.click(screen.getByRole('button', { name: /Booking khách gọi/ }));
    fireEvent.click(screen.getByLabelText('Lặp lại hằng tuần'));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu booking' }));

    const errorAlert = await screen.findByRole('alert');
    expect(errorAlert.textContent).toBe('Mọi buổi đều đã có người đặt');
    expect(screen.getByRole('heading', { name: 'Booking khách gọi' })).toBeTruthy();
  });

  it('deadline text of a pending request shows its units (review of PR 240)', () => {
    expect(formatDeadlineRemaining('2026-11-20T02:59:30Z', '2026-11-20T10:00:00Z')).toBe('1 giờ 59 phút');
    expect(formatDeadlineRemaining('2026-11-20T02:00:30Z', '2026-11-20T10:00:00Z')).toBe('1 giờ');
    expect(formatDeadlineRemaining('2026-11-20T01:45:30Z', '2026-11-20T10:00:00Z')).toBe('45 phút');
    expect(formatDeadlineRemaining('2026-11-20T00:00:00Z', '2026-11-20T10:00:00Z')).toBe('Hết hạn');
  });
});
