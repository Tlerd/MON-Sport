import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as clientModule from '@monsport/client';
import { ApiError } from '@monsport/client';
import { PHONE_MESSAGE, type FreeRange } from '@monsport/shared';
import { BarsProvider } from '../../app/bars';
import { PhoneBookingSheet, type PhoneBookingSheetProps } from './PhoneBookingSheet';

vi.mock('@monsport/client', async () => {
  const actual = await vi.importActual<typeof import('@monsport/client')>('@monsport/client');
  return {
    ...actual,
    api: vi.fn(),
  };
});

const C1 = '00000000-0000-4000-8000-000000000001';
const COURT = {
  id: C1,
  name: 'Sân 1',
  priceNormal: 100000,
  pricePeak: 150000,
};
const DATE = '2026-11-06';
const NOW = new Date('2026-11-06T15:10:00+07:00');
const FREE_SAN_1: FreeRange[] = [
  { startAt: '2026-11-06T15:30:00+07:00', endAt: '2026-11-06T22:00:00+07:00' },
];
const FREE_SAN_2: FreeRange[] = [
  { startAt: '2026-11-06T15:30:00+07:00', endAt: '2026-11-06T18:00:00+07:00' },
  { startAt: '2026-11-06T20:00:00+07:00', endAt: '2026-11-06T22:00:00+07:00' },
];

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function renderSheet(overrides: Partial<PhoneBookingSheetProps> = {}) {
  const onSaved = vi.fn();
  const onClose = vi.fn();
  const onSessionExpired = vi.fn();
  const onCourtGone = vi.fn();
  const onConflict = vi.fn();
  const props: PhoneBookingSheetProps = {
    court: COURT,
    date: DATE,
    start: 960,
    free: FREE_SAN_1,
    onSaved,
    onClose,
    onSessionExpired,
    onCourtGone,
    onConflict,
    ...overrides,
  };
  const view = render(
    <BarsProvider>
      <PhoneBookingSheet {...props} />
    </BarsProvider>,
  );
  const rerenderSheet = (next: Partial<PhoneBookingSheetProps> = {}) =>
    view.rerender(
      <BarsProvider>
        <PhoneBookingSheet {...props} {...next} />
      </BarsProvider>,
    );
  return { onSaved, onClose, onSessionExpired, onCourtGone, onConflict, rerenderSheet, ...view };
}

describe('PhoneBookingSheet', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('AC-4: shows title "Nhập booking khách gọi", court, "16:00–17:00 ngày 06/11/2026", duration chips fitting free range, "1 giờ" preselected at "100.000đ", "2 giờ" at "250.000đ", optional inputs with maxLength 100', () => {
    const { unmount } = renderSheet();

    const dialog = screen.getByRole('dialog', { name: 'Nhập booking khách gọi' });
    expect(within(dialog).getByText('Sân 1')).toBeDefined();
    expect(within(dialog).getByText('16:00–17:00 ngày 06/11/2026')).toBeDefined();

    const group = within(dialog).getByRole('group', { name: 'Thời lượng' });
    const chips = within(group).getAllByRole('button');
    expect(chips.map((c) => c.textContent)).toEqual(['1 giờ', '1,5 giờ', '2 giờ', '2,5 giờ', '3 giờ']);
    expect(chips[0]!.getAttribute('aria-pressed')).toBe('true');
    expect(within(dialog).getByText('100.000đ')).toBeDefined();

    fireEvent.click(within(group).getByRole('button', { name: '2 giờ' }));
    expect(within(group).getByRole('button', { name: '2 giờ' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(dialog).getByText('16:00–18:00 ngày 06/11/2026')).toBeDefined();
    expect(within(dialog).getByText('250.000đ')).toBeDefined();

    const nameInput = within(dialog).getByLabelText('Tên khách') as HTMLInputElement;
    const phoneInput = within(dialog).getByLabelText('Số điện thoại') as HTMLInputElement;
    expect(nameInput.required).toBe(false);
    expect(nameInput.maxLength).toBe(100);
    expect(phoneInput.required).toBe(false);

    unmount();

    // Sân 2 at 16:00 with free 15:30-18:00 only fits up to 2 hours
    renderSheet({ court: { ...COURT, name: 'Sân 2' }, free: FREE_SAN_2 });
    const dialog2 = screen.getByRole('dialog', { name: 'Nhập booking khách gọi' });
    const chips2 = within(within(dialog2).getByRole('group', { name: 'Thời lượng' })).getAllByRole('button');
    expect(chips2.map((c) => c.textContent)).toEqual(['1 giờ', '1,5 giờ', '2 giờ']);
  });

  it('D-7: shows end time 24:00 when chosen duration ends at midnight', () => {
    renderSheet({
      start: 1320,
      free: [{ startAt: '2026-11-06T22:00:00+07:00', endAt: '2026-11-07T00:00:00+07:00' }],
    });

    const dialog = screen.getByRole('dialog', { name: 'Nhập booking khách gọi' });
    expect(within(dialog).getByText('22:00–23:00 ngày 06/11/2026')).toBeDefined();

    fireEvent.click(within(dialog).getByRole('button', { name: '2 giờ' }));
    expect(within(dialog).getByText('22:00–24:00 ngày 06/11/2026')).toBeDefined();
  });

  it('AC-5: submits POST /api/owner/bookings with ISO instants and trimmed fields, locks button while pending, calls onSaved on 201, and omits empty customer fields', async () => {
    const post = deferred<unknown>();
    vi.mocked(clientModule.api).mockImplementation((() => post.promise) as never);

    const { onSaved, onClose, unmount } = renderSheet();
    const dialog = screen.getByRole('dialog', { name: 'Nhập booking khách gọi' });

    fireEvent.click(within(dialog).getByRole('button', { name: '2 giờ' }));
    fireEvent.change(within(dialog).getByLabelText('Tên khách'), { target: { value: '  Chú Ba  ' } });
    fireEvent.change(within(dialog).getByLabelText('Số điện thoại'), { target: { value: ' 0901234567 ' } });

    const submitBtn = within(dialog).getByRole('button', { name: 'Lưu booking' }) as HTMLButtonElement;
    fireEvent.click(submitBtn);
    expect(submitBtn.disabled).toBe(true);
    fireEvent.click(submitBtn);
    expect(vi.mocked(clientModule.api)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(clientModule.api)).toHaveBeenCalledWith('/api/owner/bookings', {
      method: 'POST',
      json: {
        courtId: C1,
        startAt: '2026-11-06T09:00:00.000Z',
        endAt: '2026-11-06T11:00:00.000Z',
        customerName: 'Chú Ba',
        customerPhone: '0901234567',
      },
    });

    // Cannot close while busy (Escape, backdrop, swipe, close button)
    const nameInput = within(dialog).getByLabelText('Tên khách');
    nameInput.focus();
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.click(screen.getByTestId('sheet-backdrop'));
    expect(dialog.contains(document.activeElement)).toBe(true);
    const closeBtn = within(dialog).getByRole('button', { name: 'Đóng' });
    fireEvent.click(closeBtn);
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.touchStart(closeBtn, { touches: [{ clientY: 100 }] });
    fireEvent.touchEnd(closeBtn, { changedTouches: [{ clientY: 200 }] });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      post.resolve({ id: 'b1', status: 'CONFIRMED', source: 'PHONE' });
    });
    expect(onSaved).toHaveBeenCalledTimes(1);

    unmount();
    vi.mocked(clientModule.api).mockClear();
    vi.mocked(clientModule.api).mockResolvedValue({ id: 'b2', status: 'CONFIRMED', source: 'PHONE' });

    renderSheet();
    const dialogEmpty = screen.getByRole('dialog', { name: 'Nhập booking khách gọi' });
    fireEvent.change(within(dialogEmpty).getByLabelText('Tên khách'), { target: { value: '   ' } });
    fireEvent.change(within(dialogEmpty).getByLabelText('Số điện thoại'), { target: { value: '' } });
    await act(async () => {
      fireEvent.click(within(dialogEmpty).getByRole('button', { name: 'Lưu booking' }));
    });

    expect(vi.mocked(clientModule.api)).toHaveBeenCalledWith('/api/owner/bookings', {
      method: 'POST',
      json: {
        courtId: C1,
        startAt: '2026-11-06T09:00:00.000Z',
        endAt: '2026-11-06T10:00:00.000Z',
      },
    });
    const sentBody = (vi.mocked(clientModule.api).mock.calls[0]?.[1] as { json: Record<string, unknown> }).json;
    expect('customerName' in sentBody).toBe(false);
    expect('customerPhone' in sentBody).toBe(false);
  });

  it('AC-6: handles 409 taken, 404 court gone, 409 BUSY, 400 validation errors, and network error while preserving inputs', async () => {
    let errorToThrow: unknown = new ApiError(409, 'Yêu cầu đang được xử lý, hãy thử lại');
    vi.mocked(clientModule.api).mockImplementation((async () => {
      throw errorToThrow;
    }) as never);

    const { onClose, onCourtGone, onConflict } = renderSheet();
    const dialog = screen.getByRole('dialog', { name: 'Nhập booking khách gọi' });

    fireEvent.click(within(dialog).getByRole('button', { name: '2 giờ' }));
    fireEvent.change(within(dialog).getByLabelText('Tên khách'), { target: { value: 'Chú Ba' } });
    fireEvent.change(within(dialog).getByLabelText('Số điện thoại'), { target: { value: '0901234567' } });

    const submitBtn = within(dialog).getByRole('button', { name: 'Lưu booking' }) as HTMLButtonElement;

    // 1. 409 BUSY -> stays open, unlocks, shows message, keeps inputs
    await act(async () => {
      fireEvent.click(submitBtn);
    });
    expect(within(dialog).getByRole('alert').textContent).toBe('Yêu cầu đang được xử lý, hãy thử lại');
    expect(submitBtn.disabled).toBe(false);
    expect((within(dialog).getByLabelText('Tên khách') as HTMLInputElement).value).toBe('Chú Ba');
    expect((within(dialog).getByLabelText('Số điện thoại') as HTMLInputElement).value).toBe('0901234567');
    expect(onClose).not.toHaveBeenCalled();

    // 2. 400 phone message
    errorToThrow = new ApiError(400, PHONE_MESSAGE);
    await act(async () => {
      fireEvent.click(submitBtn);
    });
    expect(within(dialog).getByRole('alert').textContent).toBe(PHONE_MESSAGE);
    expect(submitBtn.disabled).toBe(false);
    expect((within(dialog).getByLabelText('Tên khách') as HTMLInputElement).value).toBe('Chú Ba');

    // 3. 400 past start time
    errorToThrow = new ApiError(400, 'Giờ bắt đầu đã qua');
    await act(async () => {
      fireEvent.click(submitBtn);
    });
    expect(within(dialog).getByRole('alert').textContent).toBe('Giờ bắt đầu đã qua');
    expect(submitBtn.disabled).toBe(false);

    // 4. Network error
    errorToThrow = new TypeError('Failed to fetch');
    await act(async () => {
      fireEvent.click(submitBtn);
    });
    expect(within(dialog).getByRole('alert').textContent).toBe('Không lưu được booking. Thử lại.');
    expect(submitBtn.disabled).toBe(false);
    expect((within(dialog).getByLabelText('Tên khách') as HTMLInputElement).value).toBe('Chú Ba');
    expect((within(dialog).getByLabelText('Số điện thoại') as HTMLInputElement).value).toBe('0901234567');

    // 5. 409 slot taken -> closes sheet and notifies conflict
    errorToThrow = new ApiError(409, 'Khung giờ này vừa có người đặt');
    await act(async () => {
      fireEvent.click(submitBtn);
    });
    expect(onConflict).toHaveBeenCalledWith('Khung giờ này vừa có người đặt');
    expect(onClose).toHaveBeenCalledTimes(1);

    // 6. 404 court not found -> closes sheet and calls onCourtGone
    errorToThrow = new ApiError(404, 'Không tìm thấy sân');
    await act(async () => {
      fireEvent.click(submitBtn);
    });
    expect(onCourtGone).toHaveBeenCalledWith('Không tìm thấy sân');
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('AC-7: when durations becomes empty after the start passes while the sheet is open, shows "Giờ bắt đầu đã qua" alert and disables "Lưu booking"', () => {
    const { rerenderSheet } = renderSheet();
    const dialog = screen.getByRole('dialog', { name: 'Nhập booking khách gọi' });
    expect(within(dialog).queryByRole('alert')).toBeNull();
    expect((within(dialog).getByRole('button', { name: 'Lưu booking' }) as HTMLButtonElement).disabled).toBe(false);

    vi.setSystemTime(new Date('2026-11-06T16:05:00+07:00'));
    rerenderSheet();

    expect(within(dialog).queryByRole('group', { name: 'Thời lượng' })).toBeNull();
    expect(within(dialog).getByRole('alert').textContent).toBe('Giờ bắt đầu đã qua');
    expect((within(dialog).getByRole('button', { name: 'Lưu booking' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('AC-9: on 401 calls onSessionExpired, unlocks button, and preserves entered values across open=false and open=true', async () => {
    vi.mocked(clientModule.api).mockRejectedValue(new ApiError(401, 'Chưa đăng nhập'));

    const { onSessionExpired, onClose, rerenderSheet } = renderSheet();
    const dialog = screen.getByRole('dialog', { name: 'Nhập booking khách gọi' });

    fireEvent.click(within(dialog).getByRole('button', { name: '2 giờ' }));
    fireEvent.change(within(dialog).getByLabelText('Tên khách'), { target: { value: 'Chú Ba' } });
    fireEvent.change(within(dialog).getByLabelText('Số điện thoại'), { target: { value: '0901234567' } });

    const submitBtn = within(dialog).getByRole('button', { name: 'Lưu booking' }) as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(submitBtn.disabled).toBe(false);

    rerenderSheet({ open: false });
    expect(screen.queryByRole('dialog', { name: 'Nhập booking khách gọi' })).toBeNull();

    rerenderSheet({ open: true });
    const reopened = screen.getByRole('dialog', { name: 'Nhập booking khách gọi' });
    expect((within(reopened).getByLabelText('Tên khách') as HTMLInputElement).value).toBe('Chú Ba');
    expect((within(reopened).getByLabelText('Số điện thoại') as HTMLInputElement).value).toBe('0901234567');
    expect(within(reopened).getByRole('button', { name: '2 giờ' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('AC-5: while the POST is pending, the dialog close controls do nothing and focus stays in the sheet', async () => {
    const post = deferred<unknown>();
    vi.mocked(clientModule.api).mockImplementation((() => post.promise) as never);

    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();

    const { onClose, onSaved } = renderSheet();
    const dialog = screen.getByRole('dialog', { name: 'Nhập booking khách gọi' });
    const nameInput = within(dialog).getByLabelText('Tên khách');
    nameInput.focus();
    expect(dialog.contains(document.activeElement)).toBe(true);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu booking' }));

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(dialog.contains(document.activeElement)).toBe(true);

    fireEvent.click(screen.getByTestId('sheet-backdrop'));
    expect(onClose).not.toHaveBeenCalled();
    expect(dialog.contains(document.activeElement)).toBe(true);

    const closeBtn = within(dialog).getByRole('button', { name: 'Đóng' });
    fireEvent.click(closeBtn);
    expect(onClose).not.toHaveBeenCalled();
    expect(dialog.contains(document.activeElement)).toBe(true);

    fireEvent.touchStart(closeBtn, { touches: [{ clientY: 100 }] });
    fireEvent.touchEnd(closeBtn, { changedTouches: [{ clientY: 200 }] });
    expect(onClose).not.toHaveBeenCalled();
    expect(dialog.contains(document.activeElement)).toBe(true);

    await act(async () => {
      post.resolve({ id: 'b1', status: 'CONFIRMED', source: 'PHONE' });
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
    opener.remove();
  });
});
