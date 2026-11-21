import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GoogleComplete } from './GoogleComplete.tsx';
import { GoogleVerify } from './GoogleVerify.tsx';
import { LoginForm } from './LoginForm.tsx';
import { RegisterForm } from './RegisterForm.tsx';
import { GoogleAccountActions } from './GoogleAccountActions.tsx';
import { GOOGLE_ERROR_MESSAGES } from './googleErrors.ts';

const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('Google Auth Web Screens (F-004)', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('AC-1: screen test (fill the form, send code, enter code, complete -> api calls in order, consent box before Gửi mã)', async () => {
    const apiCalls: Array<{ url: string; method: string; body?: any }> = [];
    const pendingData = { name: 'Lan', email: 'lan@example.com' };
    const sessionUser = { id: '0199a1b2-0000-7000-8000-000000000009', name: 'Lan', role: 'USER' };

    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        const method = init?.method ?? 'GET';
        const body = init?.body ? JSON.parse(init.body as string) : undefined;
        apiCalls.push({ url, method, body });

        if (url === '/api/auth/google/pending') {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(pendingData) });
        }
        if (url === '/api/auth/google/otp') {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ resendAfter: 60 }) });
        }
        if (url === '/api/auth/google/complete') {
          return Promise.resolve({ ok: true, status: 201, json: () => Promise.resolve(sessionUser) });
        }
        return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
      }),
    );

    const onLogin = vi.fn();
    render(<GoogleComplete onLogin={onLogin} />);

    // Shows name and email from pending
    expect(await screen.findByText('lan@example.com')).toBeTruthy();
    const nameInput = screen.getByLabelText(/^Tên/) as HTMLInputElement;
    expect(nameInput.value).toBe('Lan');

    // Consent box before Gửi mã
    const notice = screen.getByRole('region', { name: 'Thông báo bảo vệ dữ liệu cá nhân' });
    const consentCheckbox = screen.getByRole('checkbox');
    const sendButton = screen.getByRole('button', { name: 'Gửi mã' });

    expect(notice.compareDocumentPosition(sendButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(consentCheckbox.compareDocumentPosition(sendButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Fill phone
    type(/^Số điện thoại/, '0901112233');

    // Gửi mã button is disabled until consent is checked
    expect((sendButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(consentCheckbox);
    expect((sendButton as HTMLButtonElement).disabled).toBe(false);

    // Send code
    fireEvent.click(sendButton);

    // Code input appears
    const codeInput = await screen.findByLabelText('Mã OTP');
    expect(codeInput).toBeTruthy();

    // Countdown button disabled
    const resendBtn = screen.getByRole('button', { name: /^Gửi lại mã/ });
    expect((resendBtn as HTMLButtonElement).disabled).toBe(true);

    // Enter code
    fireEvent.change(codeInput, { target: { value: '123456' } });

    // Complete
    const completeButton = screen.getByRole('button', { name: 'Hoàn tất' });
    fireEvent.click(completeButton);

    await waitFor(() => expect(onLogin).toHaveBeenCalledWith(sessionUser));

    // Verify API calls in order
    expect(apiCalls.map((c) => ({ url: c.url, method: c.method }))).toEqual([
      { url: '/api/auth/google/pending', method: 'GET' },
      { url: '/api/auth/google/otp', method: 'POST' },
      { url: '/api/auth/google/complete', method: 'POST' },
    ]);

    expect(apiCalls[1].body).toEqual({
      purpose: 'google_signup',
      phone: '0901112233',
      consent: true,
    });
    expect(apiCalls[2].body).toEqual({
      name: 'Lan',
      phone: '0901112233',
      code: '123456',
      consent: true,
    });
  });

  it('AC-19: no Google button when providers.google is false', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ google: false }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const providersCalled = () =>
      expect(fetchMock.mock.calls.some(([url]) => url === '/api/auth/providers')).toBe(true);

    const onLogin = vi.fn();
    render(<LoginForm onLogin={onLogin} />);
    // Wait until the providers fetch ran and its promise settled, so the assert is not vacuous.
    await waitFor(providersCalled);
    await act(async () => {});
    expect(screen.queryByText('Tiếp tục với Google')).toBeNull();

    cleanup();
    fetchMock.mockClear();
    render(<RegisterForm onLogin={onLogin} />);
    await waitFor(providersCalled);
    await act(async () => {});
    expect(screen.queryByText('Tiếp tục với Google')).toBeNull();
  });

  it('shows Google button when providers.google is true', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ google: true }),
      }),
    );

    const onLogin = vi.fn();
    render(<LoginForm onLogin={onLogin} />);

    const googleBtn = await screen.findByRole('link', { name: 'Tiếp tục với Google' });
    expect(googleBtn).toBeTruthy();
    expect(googleBtn.getAttribute('href')).toBe('/api/auth/google/start');
  });

  it('AC-26: wrong code shows "Mã không đúng"', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/auth/google/pending') {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ name: 'Lan' }) });
        }
        if (url === '/api/auth/google/otp') {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ resendAfter: 60 }) });
        }
        if (url === '/api/auth/google/complete') {
          return Promise.resolve({
            ok: false,
            status: 400,
            json: () => Promise.resolve({ message: 'Mã không đúng' }),
          });
        }
        return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
      }),
    );

    render(<GoogleComplete onLogin={vi.fn()} />);

    type(/^Số điện thoại/, '0901112233');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Gửi mã' }));

    const codeInput = await screen.findByLabelText('Mã OTP');
    fireEvent.change(codeInput, { target: { value: '654321' } });

    fireEvent.click(screen.getByRole('button', { name: 'Hoàn tất' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Mã không đúng');
  });

  it('AC-42: verify screen sends google_verify and then verify', async () => {
    const apiCalls: Array<{ url: string; method: string; body?: any }> = [];
    const sessionUser = { id: '0199a1b2-0000-7000-8000-000000000002', name: 'An', role: 'USER' };

    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        const method = init?.method ?? 'GET';
        const body = init?.body ? JSON.parse(init.body as string) : undefined;
        apiCalls.push({ url, method, body });

        if (url === '/api/auth/google/otp') {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ resendAfter: 60 }) });
        }
        if (url === '/api/auth/google/verify') {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(sessionUser) });
        }
        return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
      }),
    );

    const onLogin = vi.fn();
    render(<GoogleVerify onLogin={onLogin} />);

    // Text that code goes to the account's phone
    expect(screen.getByText(/số điện thoại của tài khoản/)).toBeTruthy();

    // Gửi mã
    const sendButton = screen.getByRole('button', { name: 'Gửi mã' });
    fireEvent.click(sendButton);

    const codeInput = await screen.findByLabelText('Mã OTP');
    fireEvent.change(codeInput, { target: { value: '123456' } });

    const verifyButton = screen.getByRole('button', { name: 'Xác minh' });
    fireEvent.click(verifyButton);

    await waitFor(() => expect(onLogin).toHaveBeenCalledWith(sessionUser));

    expect(apiCalls.map((c) => ({ url: c.url, method: c.method, body: c.body }))).toEqual([
      { url: '/api/auth/google/otp', method: 'POST', body: { purpose: 'google_verify' } },
      { url: '/api/auth/google/verify', method: 'POST', body: { code: '123456' } },
    ]);
  });

  it('verify screen 403 shows "Tài khoản đã bị khóa. Liên hệ admin của MONSPORT"', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/auth/google/otp') {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ resendAfter: 60 }) });
        }
        if (url === '/api/auth/google/verify') {
          return Promise.resolve({
            ok: false,
            status: 403,
            json: () => Promise.resolve({ message: 'Tài khoản đã bị khóa. Liên hệ admin của MONSPORT' }),
          });
        }
        return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
      }),
    );

    render(<GoogleVerify onLogin={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Gửi mã' }));
    const codeInput = await screen.findByLabelText('Mã OTP');
    fireEvent.change(codeInput, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác minh' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Tài khoản đã bị khóa. Liên hệ admin của MONSPORT');
  });

  it('shows clear Vietnamese error message for google_error query parameter', async () => {
    for (const [code, message] of Object.entries(GOOGLE_ERROR_MESSAGES)) {
      cleanup();
      window.history.pushState({}, '', `/?google_error=${code}`);
      render(<LoginForm onLogin={vi.fn()} />);
      expect((await screen.findByRole('alert')).textContent).toBe(message);
    }
    cleanup();
    window.history.pushState({}, '', '/?google_error=constructor');
    render(<LoginForm onLogin={vi.fn()} />);
    expect((await screen.findByRole('alert')).textContent).toBe(GOOGLE_ERROR_MESSAGES.unknown);
  });

  it('signed-in account area shows link and unlink Google buttons and handles unlink 400', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/auth/providers') {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ google: true }) });
        }
        if (url === '/api/auth/google/unlink') {
          return Promise.resolve({
            ok: false,
            status: 400,
            json: () => Promise.resolve({ message: 'Hãy đặt mật khẩu trước khi gỡ Google' }),
          });
        }
        return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
      }),
    );

    render(<GoogleAccountActions />);

    const unlinkBtn = await screen.findByRole('button', { name: 'Gỡ liên kết Google' });
    expect(screen.getByRole('button', { name: 'Liên kết Google' })).toBeTruthy();

    fireEvent.click(unlinkBtn);
    expect((await screen.findByRole('alert')).textContent).toBe('Hãy đặt mật khẩu trước khi gỡ Google');
  });

  it('signed-in account area link-start posts password and navigates to returned url', async () => {
    const apiCalls: Array<{ url: string; method: string; body?: any }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        const method = init?.method ?? 'GET';
        const body = init?.body ? JSON.parse(init.body as string) : undefined;
        apiCalls.push({ url, method, body });

        if (url === '/api/auth/providers') {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ google: true }) });
        }
        if (url === '/api/auth/google/link-start') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ url: 'https://accounts.google.com/o/oauth2/auth' }),
          });
        }
        return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
      }),
    );

    render(<GoogleAccountActions />);

    const linkBtn = await screen.findByRole('button', { name: 'Liên kết Google' });
    fireEvent.click(linkBtn);

    const passwordInput = screen.getByLabelText('Mật khẩu');
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    fireEvent.click(screen.getByRole('button', { name: 'Liên kết Google' }));

    await waitFor(() => {
      const call = apiCalls.find((c) => c.url === '/api/auth/google/link-start');
      expect(call).toBeDefined();
      expect(call?.body).toEqual({ password: 'password123' });
    });
  });

  const EXPIRED = 'Phiên Google đã hết hạn, hãy thử lại.';
  const expectExpired = async () => {
    expect(await screen.findByText(EXPIRED)).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Tiếp tục với Google' });
    expect(link.getAttribute('href')).toBe('/api/auth/google/start');
    expect(screen.queryByRole('button', { name: /Gửi mã|Hoàn tất|Xác minh/ })).toBeNull();
  };

  it('F-004 review: complete screen shows the expired message when pending returns 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ message: 'Không tìm thấy' }) }),
      ),
    );
    render(<GoogleComplete onLogin={vi.fn()} />);
    await expectExpired();
  });

  it('F-004 review: complete screen shows the expired message when otp returns 400 for a missing cookie', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/auth/google/pending') {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ name: 'Lan' }) });
        }
        return Promise.resolve({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ message: 'Thiếu thông tin đăng ký Google' }),
        });
      }),
    );
    render(<GoogleComplete onLogin={vi.fn()} />);
    type(/^Số điện thoại/, '0901112233');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Gửi mã' }));
    await expectExpired();
  });

  it('F-004 review: complete screen shows the expired message when complete returns 400 for a missing cookie', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/auth/google/pending') {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ name: 'Lan' }) });
        }
        if (url === '/api/auth/google/otp') {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ resendAfter: 60 }) });
        }
        return Promise.resolve({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ message: 'Thiếu hoặc hỏng thông tin đăng ký Google' }),
        });
      }),
    );
    render(<GoogleComplete onLogin={vi.fn()} />);
    type(/^Số điện thoại/, '0901112233');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Gửi mã' }));
    fireEvent.change(await screen.findByLabelText(/^Mã OTP/), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn tất' }));
    await expectExpired();
  });

  it('F-004 review: verify screen shows the expired message when otp returns 400 for a missing cookie', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ message: 'Thiếu thông tin xác minh Google' }),
        }),
      ),
    );
    render(<GoogleVerify onLogin={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Gửi mã' }));
    await expectExpired();
  });

  it('F-004 review: a 429 with retryAfter before the first code shows "Gửi mã (Ns)" on both screens', async () => {
    const tooMany = () =>
      Promise.resolve({
        ok: false,
        status: 429,
        json: () => Promise.resolve({ message: 'Bạn gửi mã quá nhiều lần', retryAfter: 30 }),
      });
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/auth/google/pending') {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ name: 'Lan' }) });
        }
        return tooMany();
      }),
    );

    render(<GoogleVerify onLogin={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Gửi mã' }));
    const verifyBtn = await screen.findByRole('button', { name: 'Gửi mã (30s)' });
    expect((verifyBtn as HTMLButtonElement).disabled).toBe(true);

    cleanup();
    render(<GoogleComplete onLogin={vi.fn()} />);
    type(/^Số điện thoại/, '0901112233');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Gửi mã' }));
    const completeBtn = await screen.findByRole('button', { name: 'Gửi mã (30s)' });
    expect((completeBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('F-004 review: the phone is read-only after a code was sent, and "Đổi số" resets the code step', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/auth/google/pending') {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ name: 'Lan' }) });
        }
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ resendAfter: 60 }) });
      }),
    );
    render(<GoogleComplete onLogin={vi.fn()} />);
    const phoneInput = screen.getByLabelText(/^Số điện thoại/) as HTMLInputElement;
    type(/^Số điện thoại/, '0901112233');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Gửi mã' }));

    fireEvent.change(await screen.findByLabelText('Mã OTP'), { target: { value: '123456' } });
    expect(phoneInput.readOnly).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Đổi số' }));
    expect(phoneInput.readOnly).toBe(false);
    expect(screen.queryByLabelText('Mã OTP')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Đổi số' })).toBeNull();
    expect((screen.getByRole('button', { name: 'Gửi mã' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('F-004 review: a successful unlink shows "Đã gỡ liên kết Google"', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/auth/providers') {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ google: true }) });
        }
        if (url === '/api/auth/google/unlink') {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
        }
        return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
      }),
    );
    render(<GoogleAccountActions />);
    fireEvent.click(await screen.findByRole('button', { name: 'Gỡ liên kết Google' }));
    expect((await screen.findByRole('status')).textContent).toBe('Đã gỡ liên kết Google');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
