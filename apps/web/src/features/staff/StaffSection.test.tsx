import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STAFF_PHONE_TAKEN } from '@monsport/shared';
import { StaffSection } from './StaffSection.tsx';

describe('StaffSection', () => {
  const venueId = '0199a1b2-0000-7000-8000-000000000010';
  const initialStaff = [
    {
      id: '0199a1b2-0000-7000-8000-000000000001',
      name: 'Nguyễn Văn An',
      phone: '0901234567',
      venueId,
      lockedAt: null,
    },
    {
      id: '0199a1b2-0000-7000-8000-000000000002',
      name: 'Trần Thị Bình',
      phone: '0907654321',
      venueId,
      lockedAt: '2026-11-12T10:00:00Z',
    },
  ];

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('AC-11: shows list of staff with name, phone, and status ("Đang làm" / "Đã khóa")', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url === `/api/owner/venues/${venueId}/staff`) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(initialStaff) });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
    }));

    render(<StaffSection venueId={venueId} />);

    expect(await screen.findByText('Nguyễn Văn An')).toBeTruthy();
    expect(screen.getByText('0901234567')).toBeTruthy();
    expect(screen.getByText('Đang làm')).toBeTruthy();

    expect(screen.getByText('Trần Thị Bình')).toBeTruthy();
    expect(screen.getByText('0907654321')).toBeTruthy();
    expect(screen.getByText('Đã khóa')).toBeTruthy();
  });

  it('AC-11: adds a new staff member with consent checkbox', async () => {
    const newStaff = {
      id: '0199a1b2-0000-7000-8000-000000000003',
      name: 'Lê Văn Cường',
      phone: '0912345678',
      venueId,
      lockedAt: null,
    };

    let postBody: Record<string, unknown> | null = null;
    vi.stubGlobal('fetch', vi.fn((url: string, opts?: RequestInit) => {
      if (url === `/api/owner/venues/${venueId}/staff` && opts?.method === 'POST') {
        postBody = JSON.parse(opts.body as string);
        return Promise.resolve({ ok: true, status: 201, json: () => Promise.resolve(newStaff) });
      }
      if (url === `/api/owner/venues/${venueId}/staff`) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(initialStaff) });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
    }));

    render(<StaffSection venueId={venueId} />);

    await screen.findByText('Nguyễn Văn An');

    fireEvent.change(screen.getByLabelText('Tên nhân viên'), { target: { value: 'Lê Văn Cường' } });
    fireEvent.change(screen.getByLabelText('Số điện thoại'), { target: { value: '0912345678' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'matkhau123' } });

    const submitBtn = screen.getByRole('button', { name: 'Thêm nhân viên' }) as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);

    const checkbox = screen.getByLabelText(/đồng ý với thông báo về dữ liệu cá nhân/i);
    fireEvent.click(checkbox);
    expect(submitBtn.disabled).toBe(false);

    fireEvent.click(submitBtn);

    expect(await screen.findByText('Lê Văn Cường')).toBeTruthy();
    expect(postBody).toEqual({
      name: 'Lê Văn Cường',
      phone: '0912345678',
      password: 'matkhau123',
      consent: true,
    });
  });

  it('AC-11: "Khóa" button requires confirmation before locking staff', async () => {
    const lockedAn = { ...initialStaff[0], lockedAt: '2026-11-12T11:00:00Z' };
    let lockCalled = false;

    vi.stubGlobal('fetch', vi.fn((url: string, opts?: RequestInit) => {
      if (url === `/api/owner/staff/${initialStaff[0].id}/lock` && opts?.method === 'POST') {
        lockCalled = true;
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(lockedAn) });
      }
      if (url === `/api/owner/venues/${venueId}/staff`) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(initialStaff) });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
    }));

    render(<StaffSection venueId={venueId} />);

    await screen.findByText('Nguyễn Văn An');

    // Nguyễn Văn An is active, has "Khóa" button; Trần Thị Bình is locked, does not have "Khóa" button
    const lockButtons = screen.getAllByRole('button', { name: 'Khóa' });
    expect(lockButtons.length).toBe(1);

    // Clicking "Khóa" reveals confirm dialog
    fireEvent.click(lockButtons[0]);
    expect(screen.getByRole('dialog', { name: `Xác nhận khóa ${initialStaff[0].name}` })).toBeTruthy();
    expect(lockCalled).toBe(false);

    // Cancel hides dialog
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(lockCalled).toBe(false);

    // Open again and confirm
    fireEvent.click(screen.getByRole('button', { name: 'Khóa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận khóa' }));

    await waitFor(() => {
      expect(lockCalled).toBe(true);
    });

    // An is now locked
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Khóa' })).toBeNull();
    });
  });

  it('AC-11: shows error when phone number is already registered', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string, opts?: RequestInit) => {
      if (url === `/api/owner/venues/${venueId}/staff` && opts?.method === 'POST') {
        return Promise.resolve({
          ok: false,
          status: 409,
          json: () => Promise.resolve({ message: STAFF_PHONE_TAKEN }),
        });
      }
      if (url === `/api/owner/venues/${venueId}/staff`) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
    }));

    render(<StaffSection venueId={venueId} />);

    fireEvent.change(screen.getByLabelText('Tên nhân viên'), { target: { value: 'Người Mới' } });
    fireEvent.change(screen.getByLabelText('Số điện thoại'), { target: { value: '0901234567' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'matkhau123' } });
    fireEvent.click(screen.getByLabelText(/đồng ý với thông báo về dữ liệu cá nhân/i));
    fireEvent.click(screen.getByRole('button', { name: 'Thêm nhân viên' }));

    expect(await screen.findByText(STAFF_PHONE_TAKEN)).toBeTruthy();
  });
});
