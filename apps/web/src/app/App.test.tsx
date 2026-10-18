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

  // Brief F-008 (AC-14): a guest and a user see the free hours, an owner and an admin do not.
  // The notice shows once for each role: the guest sees it in the free hours, the user in the booking form.
  const NOTICE = 'App mới ra mắt. Hãy gọi chủ sân và xem kỹ thông tin trước khi đặt.';
  const as = (me: unknown) => vi.stubGlobal('fetch', vi.fn((url: string) => {
    const [status, body] = url === '/api/auth/me' ? (me ? [200, me] : [401, { message: 'Bạn cần đăng nhập' }]) : [200, []];
    return Promise.resolve({ ok: (status as number) < 400, status, json: () => Promise.resolve(body) });
  }));

  it('AC-14: a guest sees the free hours and the notice once', async () => {
    as(null);
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Giờ trống' })).toBeTruthy();
    expect(screen.getAllByText(NOTICE)).toHaveLength(1);
  });

  it('AC-14: a user sees the free hours and the booking form, and the notice once', async () => {
    as({ id: 'x', name: 'An', role: 'USER' });
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Giờ trống' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Đặt sân' })).toBeTruthy();
    expect(screen.getAllByText(NOTICE)).toHaveLength(1);
  });

  it('AC-7: a user sees the search box once, in the free hours, and the booking form has none', async () => {
    as({ id: 'x', name: 'An', role: 'USER' });
    render(<App />);
    const freeHours = (await screen.findByRole('heading', { name: 'Giờ trống' })).closest('section')!;
    expect(screen.getAllByLabelText('Tìm theo tên sân')).toHaveLength(1);
    expect(within(freeHours).getByLabelText('Tìm theo tên sân')).toBeTruthy();
    expect(within(screen.getByRole('heading', { name: 'Đặt sân' }).closest('section')!).queryByLabelText('Tìm theo tên sân')).toBeNull();
  });

  it.each([['OWNER', 'Yêu cầu đặt sân'], ['ADMIN', null]] as const)('AC-14: a %s does not see the free hours', async (role, heading) => {
    as({ id: 'x', name: 'Bình', role });
    render(<App />);
    if (heading) await screen.findByRole('heading', { name: heading });
    else await screen.findByText('Chào Bình');
    expect(screen.queryByRole('heading', { name: 'Giờ trống' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Phòng chờ' })).toBeNull();
  });

  it('AC-16: both a guest and a USER see "Phòng chờ"', async () => {
    as(null);
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Phòng chờ' })).toBeTruthy();
    cleanup();

    as({ id: 'x', name: 'An', role: 'USER' });
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Phòng chờ' })).toBeTruthy();
  });

  it('AC-13: a USER sees "Trận đã vào", while guests, owners, and admins do not', async () => {
    as({ id: 'x', name: 'An', role: 'USER' });
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Trận đã vào' })).toBeTruthy();
    cleanup();

    as(null);
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Phòng chờ' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Trận đã vào' })).toBeNull();
    cleanup();

    as({ id: 'x', name: 'Bình', role: 'OWNER' });
    render(<App />);
    await screen.findByRole('heading', { name: 'Yêu cầu đặt sân' });
    expect(screen.queryByRole('heading', { name: 'Trận đã vào' })).toBeNull();
    cleanup();

    as({ id: 'x', name: 'Admin', role: 'ADMIN' });
    render(<App />);
    await screen.findByText('Chào Admin');
    expect(screen.queryByRole('heading', { name: 'Trận đã vào' })).toBeNull();
  });
});
