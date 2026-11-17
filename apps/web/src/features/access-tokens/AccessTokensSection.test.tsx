import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessTokensSection } from './AccessTokensSection.tsx';

describe('AccessTokensSection (F-037)', () => {
  const token = {
    id: '0199a1b2-0000-7000-8000-000000000001',
    name: 'Claude Code',
    scope: 'BOOK',
    prefix: 'mst_abcd1234',
    createdAt: '2026-12-01T03:00:00.000Z',
    expiresAt: '2026-12-31T03:00:00.000Z',
    lastUsedAt: null,
  };
  const ok = (body: unknown, status = 200) => Promise.resolve({ ok: true, status, json: () => Promise.resolve(body) });
  const writeText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    writeText.mockClear();
    vi.stubGlobal('navigator', { clipboard: { writeText } });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('AC-13: lists the token with its name, "Đặt sân", the prefix, "Hết hạn 31/12/2026" and "Chưa dùng"', async () => {
    vi.stubGlobal('fetch', vi.fn(() => ok({ tokens: [token] })));
    render(<AccessTokensSection />);

    expect(await screen.findByText('Claude Code')).toBeTruthy();
    expect(screen.getAllByText('Đặt sân').length).toBeGreaterThan(0);
    expect(screen.getByText('mst_abcd1234…')).toBeTruthy();
    expect(screen.getByText('Hết hạn 31/12/2026')).toBeTruthy();
    expect(screen.getByText('Chưa dùng')).toBeTruthy();
  });

  it('AC-13: "Thu hồi" asks first, then sends DELETE and removes the row', async () => {
    const fetchMock = vi.fn((url: string, opts?: RequestInit) => {
      if (url === `/api/me/access-tokens/${token.id}` && opts?.method === 'DELETE') {
        return Promise.resolve({ ok: true, status: 204, json: () => Promise.resolve(undefined) });
      }
      return ok({ tokens: [token] });
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<AccessTokensSection />);

    await screen.findByText('Claude Code');
    fireEvent.click(screen.getByRole('button', { name: 'Thu hồi' }));
    expect(screen.getByRole('dialog', { name: 'Xác nhận thu hồi Claude Code' })).toBeTruthy();
    expect(fetchMock.mock.calls.some(([, o]) => (o as RequestInit | undefined)?.method === 'DELETE')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận thu hồi' }));
    await waitFor(() => expect(screen.queryByText('Claude Code')).toBeNull());
    const del = fetchMock.mock.calls.find(([, o]) => (o as RequestInit | undefined)?.method === 'DELETE');
    expect(del?.[0]).toBe(`/api/me/access-tokens/${token.id}`);
  });

  it('AC-14: fills "Máy tính", "Chỉ xem", "90 ngày", sends { name: "Máy tính", scope: "READ", expiresInDays: 90 }, shows the secret once with the warning, "Chép" and the claude mcp add command; "Xong" hides it', async () => {
    const secret = 'mst_abcd1234_secretsecretsecret';
    const created = { ...token, id: '0199a1b2-0000-7000-8000-000000000002', name: 'Máy tính', scope: 'READ' };
    let postBody: unknown = null;
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, opts?: RequestInit) => {
        if (url === '/api/me/access-tokens' && opts?.method === 'POST') {
          postBody = JSON.parse(opts.body as string);
          return ok({ token: created, secret }, 201);
        }
        return ok({ tokens: [] });
      }),
    );
    render(<AccessTokensSection />);

    await screen.findByText('Bạn chưa có mã nào.');
    fireEvent.change(screen.getByLabelText('Tên mã'), { target: { value: 'Máy tính' } });
    // "Chỉ xem" is the default. Pick "Đặt sân" first, so the test shows that the buttons change the sent scope.
    expect(screen.getByRole('button', { name: 'Chỉ xem' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Đặt sân' }));
    expect(screen.getByRole('button', { name: 'Đặt sân' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Chỉ xem' }));
    fireEvent.click(screen.getByRole('button', { name: '90 ngày' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tạo mã' }));

    await screen.findByText('Mã chỉ hiện một lần. Lưu nó ngay');
    expect(postBody).toEqual({ name: 'Máy tính', scope: 'READ', expiresInDays: 90 });
    expect(screen.getByText(secret)).toBeTruthy();
    expect(screen.getByText('Ai có mã này thì đặt sân được bằng tài khoản của bạn. Không gửi mã cho người khác.')).toBeTruthy();
    const command = `claude mcp add --transport http monsport ${window.location.origin}/api/mcp --header "Authorization: Bearer ${secret}"`;
    expect(screen.getByText(command)).toBeTruthy();

    const copyButtons = screen.getAllByRole('button', { name: 'Chép' });
    expect(copyButtons.length).toBe(2);
    fireEvent.click(copyButtons[0]);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(secret));
    await screen.findByRole('button', { name: 'Đã chép' });

    fireEvent.click(screen.getByRole('button', { name: 'Xong' }));
    expect(screen.queryByText(secret)).toBeNull();
    expect(screen.queryByText(command)).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();

    // A fresh render lists tokens from the API and never shows the secret.
    cleanup();
    vi.stubGlobal('fetch', vi.fn(() => ok({ tokens: [created] })));
    render(<AccessTokensSection />);
    await screen.findByText('Máy tính');
    expect(screen.queryByText(secret)).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('AC-14: a 409 from the API shows the API message', async () => {
    const message = 'Bạn đã có 5 mã. Thu hồi một mã trước';
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, opts?: RequestInit) => {
        if (url === '/api/me/access-tokens' && opts?.method === 'POST') {
          return Promise.resolve({ ok: false, status: 409, json: () => Promise.resolve({ message }) });
        }
        return ok({ tokens: [] });
      }),
    );
    render(<AccessTokensSection />);

    await screen.findByText('Bạn chưa có mã nào.');
    fireEvent.change(screen.getByLabelText('Tên mã'), { target: { value: 'Máy tính' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tạo mã' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(message);
  });
});
