import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.tsx';

describe('App', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows the login form when nobody is signed in', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: () => Promise.resolve({ message: 'Bạn cần đăng nhập' }) }));
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeTruthy();
  });

  it('AC-25: after the sign-up, the booking form and the name "Lan" in the top bar show', async () => {
    const lan = { id: '0199a1b2-0000-7000-8000-000000000009', name: 'Lan', role: 'USER' };
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      const [status, body] = url === '/api/auth/me' ? [401, { message: 'Bạn cần đăng nhập' }] : url === '/api/auth/register' ? [201, lan] : [200, []];
      return Promise.resolve({ ok: (status as number) < 400, status, json: () => Promise.resolve(body) });
    }));
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Tạo tài khoản' }));
    fireEvent.change(screen.getByLabelText('Tên của bạn'), { target: { value: 'Lan' } });
    fireEvent.change(screen.getByLabelText('Số điện thoại'), { target: { value: '0901112233' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'matkhau123' } });
    expect((screen.getByRole('button', { name: 'Tạo tài khoản' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    expect(await screen.findByRole('heading', { name: 'Đặt sân' })).toBeTruthy();
    expect(within(screen.getByRole('banner')).getByText('Lan')).toBeTruthy();
  });

  it('shows the owner requests to an owner', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(url === '/api/auth/me' ? { id: 'x', name: 'Bình', role: 'OWNER' } : []) }),
    ));
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Yêu cầu đặt sân' })).toBeTruthy();
  });
});
