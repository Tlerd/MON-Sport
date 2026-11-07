import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as clientModule from '@monsport/client';
import { ApiError } from '@monsport/client';
import { Messages, PRIVACY_NOTICE } from '@monsport/shared';
import { SessionProvider } from '../../app/session.tsx';
import { RegisterSheet } from './RegisterSheet.tsx';

vi.mock('@monsport/client', async () => {
  const actual = await vi.importActual<typeof import('@monsport/client')>('@monsport/client');
  return {
    ...actual,
    api: vi.fn(),
  };
});

const CONSENT_LABEL = 'Tôi đồng ý với thông báo bảo vệ dữ liệu cá nhân';
const NETWORK_ERROR = 'Không kết nối được. Thử lại sau';

function mockApi(register: (init: unknown) => Promise<unknown>) {
  vi.mocked(clientModule.api).mockImplementation(async (path: string, init?: any) => {
    if (path === '/api/auth/me') throw new ApiError(401, 'Chưa đăng nhập');
    if (path === '/api/auth/register') return register(init);
    return {};
  });
}

function renderSheet(onClose = vi.fn()) {
  render(
    <SessionProvider>
      <RegisterSheet open onClose={onClose} />
    </SessionProvider>,
  );
  return onClose;
}

function fillForm(consent: boolean) {
  fireEvent.change(screen.getByLabelText('Tên'), { target: { value: 'Lan' } });
  fireEvent.change(screen.getByLabelText('Số điện thoại'), { target: { value: '0912345678' } });
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'Sanbong#2026' } });
  const box = screen.getByLabelText(CONSENT_LABEL) as HTMLInputElement;
  if (consent !== box.checked) fireEvent.click(box);
}

const submitButton = () => screen.getByRole('button', { name: 'Tạo tài khoản' });

describe('RegisterSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('AC-2: shows the fields, the 5 notice paragraphs and an unchecked consent box', async () => {
    mockApi(async () => ({}));
    renderSheet();

    expect(screen.getByRole('heading', { name: 'Tạo tài khoản' })).toBeDefined();
    expect(screen.getByLabelText('Tên')).toBeDefined();
    expect(screen.getByLabelText('Số điện thoại')).toBeDefined();
    const password = screen.getByLabelText('Mật khẩu') as HTMLInputElement;
    expect(password.type).toBe('password');
    expect(password.autocomplete).toBe('new-password');

    const paragraphs = PRIVACY_NOTICE.split('\n');
    expect(paragraphs).toHaveLength(5);
    for (const text of paragraphs) expect(screen.getByText(text)).toBeDefined();

    const box = screen.getByLabelText(CONSENT_LABEL) as HTMLInputElement;
    expect(box.type).toBe('checkbox');
    expect(box.checked).toBe(false);
  });

  it('AC-3: posts name, phone, password and consent once, locks the button, then refreshes and closes', async () => {
    let finish: (v: unknown) => void = () => {};
    mockApi(() => new Promise((resolve) => (finish = resolve)));
    const onClose = renderSheet();
    await waitFor(() => expect(clientModule.api).toHaveBeenCalledWith('/api/auth/me'));
    vi.mocked(clientModule.api).mockClear();

    fillForm(true);
    await act(async () => {
      fireEvent.click(submitButton());
    });

    const posts = vi.mocked(clientModule.api).mock.calls.filter(([p]) => p === '/api/auth/register');
    expect(posts).toHaveLength(1);
    expect(posts[0][1]).toEqual(
      expect.objectContaining({
        method: 'POST',
        json: { name: 'Lan', phone: '0912345678', password: 'Sanbong#2026', consent: true },
      }),
    );
    expect((screen.getByRole('button', { name: /Đang tạo/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      finish({ id: 'u1', name: 'Lan', role: 'USER' });
    });

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(clientModule.api).toHaveBeenCalledWith('/api/auth/me');
  });

  it('AC-4: without consent makes no API call and shows the consent message', async () => {
    mockApi(async () => ({}));
    const onClose = renderSheet();
    await waitFor(() => expect(clientModule.api).toHaveBeenCalledWith('/api/auth/me'));
    vi.mocked(clientModule.api).mockClear();

    fillForm(false);
    await act(async () => {
      fireEvent.click(submitButton());
    });

    expect(clientModule.api).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe(Messages.consent);
    expect(onClose).not.toHaveBeenCalled();
  });

  it.each([
    ['409', new ApiError(409, 'Số điện thoại này đã có tài khoản'), 'Số điện thoại này đã có tài khoản'],
    ['400', new ApiError(400, Messages.weakPassword), Messages.weakPassword],
    ['429', new ApiError(429, Messages.tooManyAttempts), Messages.tooManyAttempts],
    ['network', new Error('Network failure'), NETWORK_ERROR],
  ])('AC-5: %s error keeps the sheet open, the data and shows the message', async (_name, error, expected) => {
    mockApi(async () => {
      throw error;
    });
    const onClose = renderSheet();

    fillForm(true);
    await act(async () => {
      fireEvent.click(submitButton());
    });

    expect(screen.getByRole('heading', { name: 'Tạo tài khoản' })).toBeDefined();
    expect(screen.getByRole('alert').textContent).toBe(expected);
    expect((submitButton() as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByLabelText('Tên') as HTMLInputElement).value).toBe('Lan');
    expect((screen.getByLabelText('Số điện thoại') as HTMLInputElement).value).toBe('0912345678');
    expect((screen.getByLabelText('Mật khẩu') as HTMLInputElement).value).toBe('Sanbong#2026');
    expect((screen.getByLabelText(CONSENT_LABEL) as HTMLInputElement).checked).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('AC-10: every button of the form is at least 44px high and the sheet can scroll', async () => {
    mockApi(async () => ({}));
    renderSheet();

    const form = screen.getByLabelText('Tên').closest('form')!;
    const buttons = [...form.querySelectorAll('button')];
    expect(buttons.map((b) => b.textContent)).toEqual(['Tạo tài khoản', 'Đã có tài khoản? Đăng nhập']);
    for (const button of buttons) expect(parseInt(button.style.minHeight || button.style.height, 10)).toBeGreaterThanOrEqual(44);
    for (const input of form.querySelectorAll('input[type=text], input[type=tel], input[type=password]'))
      expect(parseInt((input as HTMLElement).style.height, 10)).toBeGreaterThanOrEqual(44);

    const dialog = screen.getByRole('dialog');
    const scroller = [...dialog.querySelectorAll<HTMLElement>('div')].find((d) => d.style.overflowY === 'auto');
    expect(scroller).toBeDefined();
    expect(scroller!.style.maxHeight).toBe('90vh');
    for (const el of form.querySelectorAll<HTMLElement>('input[type=text], input[type=tel], input[type=password]'))
      expect(el.style.width).toBe('100%');
  });
});
