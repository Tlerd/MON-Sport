import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as clientModule from '@monsport/client';
import { ApiError } from '@monsport/client';
import type { CourtView, FreeRange } from '@monsport/shared';
import { BookingSheet } from './BookingSheet.tsx';

vi.mock('@monsport/client', async () => {
  const actual = await vi.importActual<typeof import('@monsport/client')>('@monsport/client');
  return { ...actual, api: vi.fn() };
});

const C1 = '00000000-0000-4000-8000-000000000001';
const COURT: CourtView = {
  id: C1,
  name: 'Sân 1',
  sport: 'BADMINTON',
  priceNormal: 80000,
  pricePeak: 120000,
};
const NOW = new Date('2026-10-29T10:00:00+07:00');
const FREE: FreeRange[] = [
  { startAt: '2026-10-30T18:00:00+07:00', endAt: '2026-10-30T20:00:00+07:00' },
  { startAt: '2026-10-30T21:00:00+07:00', endAt: '2026-10-30T23:00:00+07:00' },
];

function Harness({
  start = 1080,
  now = NOW,
  onClose = () => {},
  onBooked = () => {},
  onConflict = () => {},
}: {
  start?: number;
  now?: Date;
  onClose?: () => void;
  onBooked?: () => void;
  onConflict?: () => void;
}) {
  const [duration, setDuration] = useState(60);
  return (
    <BookingSheet
      open
      court={COURT}
      date="2026-10-30"
      start={start}
      duration={duration}
      free={FREE}
      now={now}
      onDuration={setDuration}
      onClose={onClose}
      onBooked={onBooked}
      onConflict={onConflict}
    />
  );
}

describe('BookingSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('AC-15: shows court, heading date, range, fitting duration chips, price, and confirmation deadline', () => {
    render(<Harness />);
    const dialog = screen.getByRole('dialog', { name: 'Gửi yêu cầu' });
    expect(within(dialog).getByText('Sân 1')).toBeDefined();
    expect(within(dialog).getByText('Thứ Sáu, 30/10/2026')).toBeDefined();
    expect(within(dialog).getByText('18:00–19:00')).toBeDefined();
    expect(within(dialog).getByText('120.000đ')).toBeDefined();
    expect(
      within(dialog).getByText('Chủ sân xác nhận trước 12:00 hôm nay. Bạn trả tiền tại sân.'),
    ).toBeDefined();

    const group = within(dialog).getByRole('group', { name: 'Thời lượng' });
    const chips = within(group).getAllByRole('button');
    expect(chips.map((c) => c.textContent)).toEqual(['1 giờ', '1,5 giờ', '2 giờ']);
    expect(chips[0].getAttribute('aria-pressed')).toBe('true');
    expect(chips[1].getAttribute('aria-pressed')).toBe('false');
  });

  it('AC-16: picking "1,5 giờ" updates the range to 18:00–19:30 and the price to 180.000đ', () => {
    render(<Harness />);
    const dialog = screen.getByRole('dialog', { name: 'Gửi yêu cầu' });
    fireEvent.click(within(dialog).getByRole('button', { name: '1,5 giờ' }));
    expect(within(dialog).getByText('18:00–19:30')).toBeDefined();
    expect(within(dialog).getByText('180.000đ')).toBeDefined();
    expect(within(dialog).getByRole('button', { name: '1,5 giờ' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('AC-17: submitting disables the button, posts the booking, shows Đã gửi yêu cầu and Chờ xác nhận, and notifies on close', async () => {
    let resolvePost!: (val: unknown) => void;
    vi.mocked(clientModule.api).mockImplementation(
      () => new Promise((r) => { resolvePost = r; }) as never,
    );
    const onClose = vi.fn();
    const onBooked = vi.fn();
    render(<Harness onClose={onClose} onBooked={onBooked} />);

    const dialog = screen.getByRole('dialog', { name: 'Gửi yêu cầu' });
    const submitBtn = within(dialog).getByRole('button', { name: 'Gửi yêu cầu' }) as HTMLButtonElement;
    fireEvent.click(submitBtn);
    expect(submitBtn.disabled).toBe(true);
    expect(clientModule.api).toHaveBeenCalledWith('/api/bookings', {
      method: 'POST',
      json: {
        courtId: C1,
        startAt: '2026-10-30T18:00:00+07:00',
        endAt: '2026-10-30T19:00:00+07:00',
      },
    });

    await act(async () => {
      resolvePost({
        id: 'b1',
        courtId: C1,
        userId: 'u1',
        startAt: '2026-10-30T18:00:00+07:00',
        endAt: '2026-10-30T19:00:00+07:00',
        priceTotal: 120000,
        status: 'PENDING',
        confirmDeadline: '2026-10-29T12:00:00+07:00',
        decidedAt: null,
        customerName: null,
        customerPhone: null,
        createdAt: '2026-10-29T10:00:00+07:00',
      });
    });

    expect(within(dialog).getByText('Đã gửi yêu cầu')).toBeDefined();
    const badgeText = within(dialog).getByText('Chờ xác nhận');
    expect(badgeText.closest('.badge')?.querySelector('svg')).not.toBeNull();
    expect(within(dialog).getByText('120.000đ')).toBeDefined();
    expect(onBooked).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Đóng' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onBooked).toHaveBeenCalledOnce();
  });

  it('AC-18: shows the 409 message and reloads, shows 400/403 API messages, and shows generic error on network failure', async () => {
    const onConflict = vi.fn();
    render(<Harness onConflict={onConflict} />);
    const dialog = screen.getByRole('dialog', { name: 'Gửi yêu cầu' });
    const submitBtn = within(dialog).getByRole('button', { name: 'Gửi yêu cầu' });

    vi.mocked(clientModule.api).mockRejectedValueOnce(new ApiError(409, 'Conflict'));
    await act(async () => {
      fireEvent.click(submitBtn);
    });
    expect(within(dialog).getByRole('alert').textContent).toBe('Khung giờ này vừa có người đặt');
    expect(onConflict).toHaveBeenCalledOnce();

    vi.mocked(clientModule.api).mockRejectedValueOnce(new ApiError(403, 'Chủ sân không được đặt sân'));
    await act(async () => {
      fireEvent.click(submitBtn);
    });
    expect(within(dialog).getByRole('alert').textContent).toBe('Chủ sân không được đặt sân');

    vi.mocked(clientModule.api).mockRejectedValueOnce(new ApiError(400, 'Khung giờ không hợp lệ'));
    await act(async () => {
      fireEvent.click(submitBtn);
    });
    expect(within(dialog).getByRole('alert').textContent).toBe('Khung giờ không hợp lệ');

    vi.mocked(clientModule.api).mockRejectedValueOnce(new Error('Network down'));
    await act(async () => {
      fireEvent.click(submitBtn);
    });
    expect(within(dialog).getByRole('alert').textContent).toBe('Không gửi được yêu cầu');
  });

  it('AC-21: at 21:30 shows only 1 giờ and 1,5 giờ, and picking 1,5 giờ shows 21:30–23:00 and 140.000đ', () => {
    render(<Harness start={1290} />);
    const dialog = screen.getByRole('dialog', { name: 'Gửi yêu cầu' });
    const group = within(dialog).getByRole('group', { name: 'Thời lượng' });
    const chips = within(group).getAllByRole('button');
    expect(chips.map((c) => c.textContent)).toEqual(['1 giờ', '1,5 giờ']);

    fireEvent.click(within(group).getByRole('button', { name: '1,5 giờ' }));
    expect(within(dialog).getByText('21:30–23:00')).toBeDefined();
    expect(within(dialog).getByText('140.000đ')).toBeDefined();
  });

  it('uses dayChipLabel when the confirmation deadline falls on another day', () => {
    render(<Harness now={new Date('2026-10-29T23:00:00+07:00')} />);
    const dialog = screen.getByRole('dialog', { name: 'Gửi yêu cầu' });
    expect(
      within(dialog).getByText('Chủ sân xác nhận trước 01:00 T6 30/10. Bạn trả tiền tại sân.'),
    ).toBeDefined();
  });
});
