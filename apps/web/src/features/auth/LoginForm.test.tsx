import { Messages } from '@monsport/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoginForm } from './LoginForm.tsx';

const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('LoginForm', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('AC-16: shows the text of a 429 answer', async () => {
    const body = { statusCode: 429, message: Messages.tooManyAttempts };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429, json: () => Promise.resolve(body) }));
    const onLogin = vi.fn();
    render(<LoginForm onLogin={onLogin} />);
    type('Số điện thoại', '0901234567');
    type('Mật khẩu', 'sai-mat-khau');
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect((await screen.findByRole('alert')).textContent).toBe(Messages.tooManyAttempts);
    expect(onLogin).not.toHaveBeenCalled();
  });
});
