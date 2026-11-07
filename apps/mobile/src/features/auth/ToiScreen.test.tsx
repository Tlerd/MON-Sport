import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  afterEach(() => {
    cleanup();
  });

  it('D-7: guest logs in with 0901234567 and correct password; sheet closes, calls GET /api/auth/me, and shows user', async () => {
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

  it('D-7: guest logs in with wrong password; sheet stays open and shows "Sai số điện thoại hoặc mật khẩu", also 403 and 429 messages', async () => {
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
          throw new ApiError(403, 'Tài khoản đã bị khóa');
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
    expect(screen.getByRole('alert').textContent).toBe('Tài khoản đã bị khóa');

    // 3. 429 Rate limited
    fireEvent.change(passInput, { target: { value: 'rate' } });
    await act(async () => {
      fireEvent.click(submitBtn);
    });
    expect(screen.getByRole('heading', { name: 'Đăng nhập' })).toBeDefined();
    expect(screen.getByRole('alert').textContent).toBe('Quá nhiều yêu cầu, vui lòng thử lại sau 5 phút');
  });

  it('D-7: shows "Không kết nối được. Thử lại sau" when login throws a non-ApiError', async () => {
    vi.mocked(clientModule.api).mockImplementation(async (path: string) => {
      if (path === '/api/auth/me') throw new ApiError(401, 'Chưa đăng nhập');
      if (path === '/api/auth/login') throw new Error('Network failure');
      return {};
    });

    render(
      <SessionProvider>
        <ToiScreen />
      </SessionProvider>,
    );

    const openBtn = await screen.findByRole('button', { name: 'Đăng nhập' });
    fireEvent.click(openBtn);

    fireEvent.change(screen.getByLabelText('Số điện thoại'), { target: { value: '0901234567' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'password' } });

    const submitBtn = screen.getAllByRole('button', { name: 'Đăng nhập' }).find((btn) => btn.getAttribute('type') === 'submit')!;
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(screen.getByRole('heading', { name: 'Đăng nhập' })).toBeDefined();
    expect(screen.getByRole('alert').textContent).toBe('Không kết nối được. Thử lại sau');
  });
});

type TestUser = { id: string; name: string; role: 'ADMIN' | 'OWNER' | 'USER' };

function mockSession(initial: TestUser | null) {
  let current = initial;
  vi.mocked(clientModule.api).mockImplementation(async (path: string) => {
    if (path === '/api/auth/me') {
      if (!current) throw new ApiError(401, 'Chưa đăng nhập');
      return current;
    }
    if (path === '/api/auth/logout') {
      current = null;
      return { ok: true };
    }
    return {};
  });
}

function renderToi() {
  return render(
    <SessionProvider>
      <ToiScreen />
    </SessionProvider>,
  );
}

describe('Tab Tôi: profile and sheet switching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('AC-1: guest sees buttons "Đăng nhập" and "Tạo tài khoản"', async () => {
    mockSession(null);
    renderToi();
    expect(await screen.findByRole('button', { name: 'Đăng nhập' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Tạo tài khoản' })).toBeDefined();
  });

  it('AC-6: USER Lan sees name, role "Người chơi" and "Đăng xuất", no "Đăng nhập"', async () => {
    mockSession({ id: 'u1', name: 'Lan', role: 'USER' });
    renderToi();
    expect(await screen.findByText('Lan')).toBeDefined();
    expect(screen.getByText('Người chơi')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Đăng xuất' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Đăng nhập' })).toBeNull();
  });

  it('AC-6 (loading): while the session loads, no guest buttons and no logout show', async () => {
    vi.mocked(clientModule.api).mockImplementation(() => new Promise(() => undefined));
    renderToi();
    expect(screen.getByRole('status', { name: 'Đang tải' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Đăng nhập' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Tạo tài khoản' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Đăng xuất' })).toBeNull();
  });

  it('AC-7: OWNER Bình sees role "Chủ sân"', async () => {
    mockSession({ id: 'u2', name: 'Bình', role: 'OWNER' });
    renderToi();
    expect(await screen.findByText('Bình')).toBeDefined();
    expect(screen.getByText('Chủ sân')).toBeDefined();
  });

  it('AC-8: logout calls POST /api/auth/logout then shows guest buttons', async () => {
    mockSession({ id: 'u1', name: 'Lan', role: 'USER' });
    renderToi();
    fireEvent.click(await screen.findByRole('button', { name: 'Đăng xuất' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Đăng nhập' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Tạo tài khoản' })).toBeDefined();
    });
    expect(clientModule.api).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
    expect(screen.queryByRole('button', { name: 'Đăng xuất' })).toBeNull();
  });

  it('AC-8: a failing logout (network or 5xx) keeps the user and shows "Không đăng xuất được. Thử lại sau"', async () => {
    for (const failure of [new Error('Network failure'), new ApiError(500, 'Lỗi máy chủ')]) {
      cleanup();
      vi.mocked(clientModule.api).mockImplementation(async (path: string) => {
        if (path === '/api/auth/me') return { id: 'u1', name: 'Lan', role: 'USER' };
        if (path === '/api/auth/logout') throw failure;
        return {};
      });
      renderToi();
      fireEvent.click(await screen.findByRole('button', { name: 'Đăng xuất' }));
      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toBe('Không đăng xuất được. Thử lại sau');
      expect(screen.getByText('Lan')).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Đăng nhập' })).toBeNull();
    }
  });

  it('D-8: a long name without spaces wraps instead of overflowing', async () => {
    mockSession({ id: 'u1', name: 'A'.repeat(80), role: 'USER' });
    renderToi();
    const name = await screen.findByTestId('user-name');
    expect(name.style.overflowWrap).toBe('anywhere');
  });

  it('AC-9: login sheet "Tạo tài khoản" switches to register sheet and back', async () => {
    mockSession(null);
    renderToi();
    fireEvent.click(await screen.findByRole('button', { name: 'Đăng nhập' }));
    const loginDialog = screen.getByRole('dialog');
    expect(within(loginDialog).getByRole('heading', { name: 'Đăng nhập' })).toBeDefined();
    fireEvent.click(within(loginDialog).getByRole('button', { name: 'Tạo tài khoản' }));

    expect(screen.queryByRole('heading', { name: 'Đăng nhập' })).toBeNull();
    const registerDialog = screen.getByRole('dialog');
    expect(within(registerDialog).getByRole('heading', { name: 'Tạo tài khoản' })).toBeDefined();

    fireEvent.click(within(registerDialog).getByRole('button', { name: 'Đã có tài khoản? Đăng nhập' }));
    expect(screen.queryByRole('heading', { name: 'Tạo tài khoản' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Đăng nhập' })).toBeDefined();
  });

  it('AC-2 (close): register sheet resets fields, password and consent after close and reopen', async () => {
    mockSession(null);
    renderToi();
    const consentLabel = 'Tôi đồng ý với thông báo bảo vệ dữ liệu cá nhân';
    fireEvent.click(await screen.findByRole('button', { name: 'Tạo tài khoản' }));
    fireEvent.change(screen.getByLabelText('Tên'), { target: { value: 'Lan' } });
    fireEvent.change(screen.getByLabelText('Số điện thoại'), { target: { value: '0912345678' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'Sanbong#2026' } });
    fireEvent.click(screen.getByLabelText(consentLabel));
    expect((screen.getByLabelText(consentLabel) as HTMLInputElement).checked).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));
    expect((screen.getByLabelText('Tên') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Số điện thoại') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText(consentLabel) as HTMLInputElement).checked).toBe(false);
  });
});
