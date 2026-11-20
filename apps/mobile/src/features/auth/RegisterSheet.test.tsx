import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as clientModule from '@monsport/client';
import { ApiError } from '@monsport/client';
import { Messages, PRIVACY_NOTICE, SKILL_LEVEL_LABELS, SKILL_LEVEL_REQUIRED_MESSAGE } from '@monsport/shared';
import { SessionProvider, useSession } from '../../app/session.tsx';
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

function SessionProbe() {
  const { user } = useSession();
  return <p data-testid="probe">{user ? user.name : 'guest'}</p>;
}

function renderSheet(onClose = vi.fn()) {
  render(
    <SessionProvider>
      <SessionProbe />
      <RegisterSheet open onClose={onClose} />
    </SessionProvider>,
  );
  return onClose;
}

function fillForm(consent: boolean, skillLevel: string = 'ADVANCED') {
  fireEvent.change(screen.getByLabelText('Tên'), { target: { value: 'Lan' } });
  fireEvent.change(screen.getByLabelText('Số điện thoại'), { target: { value: '0912345678' } });
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'Sanbong#2026' } });
  fireEvent.change(screen.getByLabelText('Trình độ'), { target: { value: skillLevel } });
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
    const form = screen.getByLabelText('Tên').closest('form')!;
    await act(async () => {
      fireEvent.submit(form);
    });

    const posts = vi.mocked(clientModule.api).mock.calls.filter(([p]) => p === '/api/auth/register');
    expect(posts).toHaveLength(1);
    expect(posts[0][1]).toEqual(
      expect.objectContaining({
        method: 'POST',
        json: { name: 'Lan', phone: '0912345678', password: 'Sanbong#2026', consent: true, skillLevel: 'ADVANCED' },
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
    expect(['90vh', '90dvh']).toContain(scroller!.style.maxHeight);
    for (const el of form.querySelectorAll<HTMLElement>('input[type=text], input[type=tel], input[type=password]'))
      expect(el.style.width).toBe('100%');
  });

  it('AC-1: shows a "Trình độ" select with Mới chơi, Trung bình, Khá and none chosen', () => {
    mockApi(async () => ({}));
    renderSheet();

    const select = screen.getByLabelText('Trình độ') as HTMLSelectElement;
    expect(select.tagName).toBe('SELECT');
    expect(select.value).toBe('');
    const labels = [...select.options].filter((o) => o.value !== '').map((o) => o.textContent);
    expect(labels).toEqual([
      SKILL_LEVEL_LABELS.BEGINNER,
      SKILL_LEVEL_LABELS.INTERMEDIATE,
      SKILL_LEVEL_LABELS.ADVANCED,
    ]);
    expect(labels).toEqual(['Mới chơi', 'Trung bình', 'Khá']);
    expect(parseInt(select.style.height, 10)).toBeGreaterThanOrEqual(44);
  });

  it('AC-2: without a level shows "Chọn trình độ", sends no request, and clears the error once a level is picked', async () => {
    mockApi(async () => ({}));
    renderSheet();
    await waitFor(() => expect(clientModule.api).toHaveBeenCalledWith('/api/auth/me'));
    vi.mocked(clientModule.api).mockClear();

    fillForm(true, '');
    await act(async () => {
      fireEvent.click(submitButton());
    });

    expect(clientModule.api).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe(SKILL_LEVEL_REQUIRED_MESSAGE);
    expect(SKILL_LEVEL_REQUIRED_MESSAGE).toBe('Chọn trình độ');

    fireEvent.change(screen.getByLabelText('Trình độ'), { target: { value: 'BEGINNER' } });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('AC-3: choosing Khá posts skillLevel ADVANCED to /api/auth/register', async () => {
    mockApi(async () => ({ id: 'u1', name: 'Lan', role: 'USER' }));
    renderSheet();
    await waitFor(() => expect(clientModule.api).toHaveBeenCalledWith('/api/auth/me'));
    vi.mocked(clientModule.api).mockClear();

    fillForm(true, '');
    fireEvent.change(screen.getByLabelText('Trình độ'), { target: { value: 'ADVANCED' } });
    await act(async () => {
      fireEvent.click(submitButton());
    });

    const posts = vi.mocked(clientModule.api).mock.calls.filter(([p]) => p === '/api/auth/register');
    expect(posts).toHaveLength(1);
    expect(posts[0][1]).toEqual(
      expect.objectContaining({ method: 'POST', json: expect.objectContaining({ skillLevel: 'ADVANCED' }) }),
    );
  });

  it('D-1: renders the error alert right above the submit button', async () => {
    mockApi(async () => ({}));
    renderSheet();

    fillForm(false);
    await act(async () => {
      fireEvent.click(submitButton());
    });

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe(Messages.consent);
    expect(alert.nextElementSibling).toBe(submitButton());
  });

  it('D-3: phone and password inputs have hints via aria-describedby, tel-national, and password length bounds', () => {
    mockApi(async () => ({}));
    renderSheet();

    const phone = screen.getByLabelText('Số điện thoại') as HTMLInputElement;
    expect(phone.autocomplete).toBe('tel-national');
    const phoneHintId = phone.getAttribute('aria-describedby');
    expect(phoneHintId).toBeTruthy();
    expect(document.getElementById(phoneHintId!)?.textContent).toContain('10 chữ số, bắt đầu bằng 0');

    const password = screen.getByLabelText('Mật khẩu') as HTMLInputElement;
    expect(password.minLength).toBe(8);
    expect(password.maxLength).toBe(128);
    const passwordHintId = password.getAttribute('aria-describedby');
    expect(passwordHintId).toBeTruthy();
    expect(document.getElementById(passwordHintId!)?.textContent).toContain('Ít nhất 8 ký tự');
  });

  it('D-4: calls login(user) with the register SessionUser before refresh(), keeping the user signed in if GET /api/auth/me fails', async () => {
    vi.mocked(clientModule.api).mockImplementation(async (path: string) => {
      if (path === '/api/auth/me') throw new ApiError(500, 'Lỗi máy chủ');
      if (path === '/api/auth/register') return { id: 'u1', name: 'Lan', role: 'USER' };
      return {};
    });

    const onClose = renderSheet();
    await waitFor(() => expect(clientModule.api).toHaveBeenCalledWith('/api/auth/me'));

    fillForm(true);
    await act(async () => {
      fireEvent.click(submitButton());
    });

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('probe').textContent).toBe('Lan');
  });
});
