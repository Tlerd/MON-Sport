import { PRIVACY_NOTICE } from '@monsport/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthPanel } from './AuthPanel.tsx';

const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('AuthPanel', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('AC-24: the sign-up button stays off until the consent box is ticked, under the privacy notice', () => {
    render(<AuthPanel onLogin={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));
    type('Tên của bạn', 'Lan');
    type('Số điện thoại', '0901112233');
    type('Mật khẩu', 'matkhau123');

    const submit = screen.getByRole('button', { name: 'Tạo tài khoản' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    for (const paragraph of PRIVACY_NOTICE.split('\n')) expect(screen.getByText(paragraph)).toBeTruthy();
    const notice = screen.getByRole('region', { name: 'Thông báo bảo vệ dữ liệu cá nhân' });
    expect(notice.tabIndex).toBe(0);
    expect(notice.compareDocumentPosition(screen.getByRole('checkbox')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('sends the consent with the sign-up and hands the new user to the app', async () => {
    const lan = { id: '0199a1b2-0000-7000-8000-000000000009', name: 'Lan', role: 'USER' };
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 201, json: () => Promise.resolve(lan) });
    vi.stubGlobal('fetch', fetch);
    const onLogin = vi.fn();
    render(<AuthPanel onLogin={onLogin} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));
    type('Tên của bạn', 'Lan');
    type('Số điện thoại', '0901112233');
    type('Mật khẩu', 'matkhau123');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));

    await vi.waitFor(() => expect(onLogin).toHaveBeenCalledWith(lan));
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ name: 'Lan', phone: '0901112233', password: 'matkhau123', consent: true });
    expect(fetch).toHaveBeenCalledWith('/api/auth/register', expect.objectContaining({ method: 'POST' }));
  });

  it('shows the error of the API, for example a phone number that has an account', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 409, json: () => Promise.resolve({ message: 'Số điện thoại này đã có tài khoản' }) }));
    render(<AuthPanel onLogin={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));
    type('Tên của bạn', 'Lan');
    type('Số điện thoại', '0901234567');
    type('Mật khẩu', 'matkhau123');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Số điện thoại này đã có tài khoản');
  });

  it('goes back to the login form, and moves focus to its heading', () => {
    render(<AuthPanel onLogin={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Tạo tài khoản' }));
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Đăng nhập' }));
  });
});
