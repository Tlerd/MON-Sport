import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as clientModule from '@monsport/client';
import { ApiError } from '@monsport/client';
import { SessionProvider } from '../../app/session.tsx';
import { ToiScreen } from './ToiScreen.tsx';

vi.mock('@monsport/client', async () => {
  const actual = await vi.importActual<typeof import('@monsport/client')>('@monsport/client');
  return {
    ...actual,
    api: vi.fn(),
  };
});

describe('Tab Tôi and Login Sheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('guest logs in with 0901234567 and correct password; sheet closes, calls GET /api/auth/me, and shows user', async () => {
    let currentUser: { id: string; name: string; role: 'ADMIN' | 'OWNER' | 'USER' } | null = null;

    vi.mocked(clientModule.api).mockImplementation(async (path: string, init?: any) => {
      if (path === '/api/auth/me') {
        if (!currentUser) throw new ApiError(401, 'Chưa đăng nhập');
        return currentUser;
      }
      if (path === '/api/auth/login') {
        const body = init?.json as { phone: string; password: string };
        if (body.phone === '0901234567' && body.password === 'matkhau123') {
          currentUser = { id: 'u1', name: 'Nguyễn Văn A', role: 'USER' };
          return { ok: true };
        }
        throw new ApiError(401, 'Sai số điện thoại hoặc mật khẩu');
      }
      return {};
    });

    render(
      <SessionProvider>
        <ToiScreen />
      </SessionProvider>,
    );

    // Initial guest state shows "Đăng nhập" button
    const openBtn = await screen.findByRole('button', { name: 'Đăng nhập' });
    expect(openBtn).toBeDefined();

    // Click to open login sheet
    fireEvent.click(openBtn);
    expect(screen.getByRole('heading', { name: 'Đăng nhập' })).toBeDefined();

    // Fill credentials
    fireEvent.change(screen.getByLabelText('Số điện thoại'), { target: { value: '0901234567' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'matkhau123' } });

    // Submit form
    const submitBtn = screen.getAllByRole('button', { name: 'Đăng nhập' }).find((btn) => btn.getAttribute('type') === 'submit');
    expect(submitBtn).toBeDefined();
    await act(async () => {
      fireEvent.click(submitBtn!);
    });

    // Sheet closes and user name appears along with "Đăng xuất"
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Đăng nhập' })).toBeNull();
      expect(screen.getByText('Nguyễn Văn A')).toBeDefined();
      expect(screen.getByRole('button', { name: 'Đăng xuất' })).toBeDefined();
    });

    expect(clientModule.api).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
      method: 'POST',
      json: { phone: '0901234567', password: 'matkhau123' },
    }));
    expect(clientModule.api).toHaveBeenCalledWith('/api/auth/me');
  });

  it('AC-15: guest logs in with wrong password; sheet stays open and shows "Sai số điện thoại hoặc mật khẩu", also 403 and 429 messages', async () => {
    vi.mocked(clientModule.api).mockImplementation(async (path: string, init?: any) => {
      if (path === '/api/auth/me') {
        throw new ApiError(401, 'Chưa đăng nhập');
      }
      if (path === '/api/auth/login') {
        const body = init?.json as { phone: string; password: string };
        if (body.password === 'wrong') {
          throw new ApiError(401, 'Sai số điện thoại hoặc mật khẩu');
        }
        if (body.password === 'locked') {
          throw new ApiError(403, 'Tài khoản đã bị tạm khóa');
        }
        if (body.password === 'rate') {
          throw new ApiError(429, 'Quá nhiều yêu cầu, vui lòng thử lại sau 5 phút');
        }
      }
      return {};
    });

    render(
      <SessionProvider>
        <ToiScreen />
      </SessionProvider>,
    );

    const openBtn = await screen.findByRole('button', { name: 'Đăng nhập' });
    fireEvent.click(openBtn);

    const phoneInput = screen.getByLabelText('Số điện thoại');
    const passInput = screen.getByLabelText('Mật khẩu');
    const submitBtn = screen.getAllByRole('button', { name: 'Đăng nhập' }).find((btn) => btn.getAttribute('type') === 'submit')!;

    // 1. Wrong password -> 401
    fireEvent.change(phoneInput, { target: { value: '0901234567' } });
    fireEvent.change(passInput, { target: { value: 'wrong' } });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(screen.getByRole('heading', { name: 'Đăng nhập' })).toBeDefined();
    expect(screen.getByRole('alert').textContent).toBe('Sai số điện thoại hoặc mật khẩu');

    // 2. 403 Forbidden
    fireEvent.change(passInput, { target: { value: 'locked' } });
    await act(async () => {
      fireEvent.click(submitBtn);
    });
    expect(screen.getByRole('heading', { name: 'Đăng nhập' })).toBeDefined();
    expect(screen.getByRole('alert').textContent).toBe('Tài khoản đã bị tạm khóa');

    // 3. 429 Rate limited
    fireEvent.change(passInput, { target: { value: 'rate' } });
    await act(async () => {
      fireEvent.click(submitBtn);
    });
    expect(screen.getByRole('heading', { name: 'Đăng nhập' })).toBeDefined();
    expect(screen.getByRole('alert').textContent).toBe('Quá nhiều yêu cầu, vui lòng thử lại sau 5 phút');
  });
});
