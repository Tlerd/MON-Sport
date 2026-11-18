import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Role, SessionUser } from '@monsport/shared';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConsentScreen } from './ConsentScreen.tsx';

// Brief F-038, AC-16: the "Cho phép" screen.

const REQUEST_ID = '0199a1b2-0000-7000-8000-0000000000aa';
const consent = {
  clientName: 'Claude',
  clientHost: 'claude.ai',
  scopes: ['read', 'book'],
  dataRead: ['Tên và số điện thoại của bạn'],
};

function Probe() {
  const loc = useLocation();
  return <p data-testid="where">{loc.pathname + loc.search}</p>;
}

type Reply = { ok: boolean; status: number; body: unknown };
const reply = (body: unknown, status = 200): Reply => ({ ok: status < 400, status, body });

function setup(session: Role | null, routes: (url: string, opts?: RequestInit) => Reply) {
  const user = session === null ? null : ({ id: '0199a1b2-0000-7000-8000-000000000101', name: 'An', role: session } as SessionUser);
  const fetchMock = vi.fn((url: string, opts?: RequestInit) => {
    const r = routes(url, opts);
    return Promise.resolve({ ok: r.ok, status: r.status, json: () => Promise.resolve(r.body) });
  });
  vi.stubGlobal('fetch', fetchMock);
  render(
    <MemoryRouter initialEntries={[`/ket-noi-ai/cho-phep?yeu-cau=${REQUEST_ID}`]}>
      <Routes>
        <Route path="/ket-noi-ai/cho-phep" element={<ConsentScreen user={user} />} />
        <Route path="/dang-nhap" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  );
  return fetchMock;
}

describe('ConsentScreen (F-038)', () => {
  const assign = vi.fn();

  afterEach(() => {
    cleanup();
    assign.mockClear();
    vi.unstubAllGlobals();
  });

  it('AC-16: a guest goes to /dang-nhap?tiep= with the path of this screen', async () => {
    setup(null, () => reply({}, 404));
    const where = await screen.findByTestId('where');
    expect(where.textContent).toBe(`/dang-nhap?tiep=%2Fket-noi-ai%2Fcho-phep%3Fyeu-cau%3D${REQUEST_ID}`);
  });

  it('AC-16: with "Đặt sân" unchecked, "Cho phép" sends { scopes: ["read"] } and goes to redirectTo', async () => {
    vi.stubGlobal('location', { assign });
    let body: unknown = null;
    setup('USER', (url, opts) => {
      if (url.endsWith('/approve') && opts?.method === 'POST') {
        body = JSON.parse(opts.body as string);
        return reply({ redirectTo: 'https://claude.ai/cb?code=x' });
      }
      return reply(consent);
    });

    await screen.findByText('Claude (claude.ai) muốn dùng tài khoản MONSPORT của bạn');
    expect((screen.getByRole('checkbox', { name: /Xem sân/ }) as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', { name: /Đặt sân/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cho phép' }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://claude.ai/cb?code=x'));
    expect(body).toEqual({ scopes: ['read'] });
  });

  it('AC-16: "Từ chối" calls deny and goes to redirectTo', async () => {
    vi.stubGlobal('location', { assign });
    const fetchMock = setup('USER', (url, opts) => {
      if (url.endsWith('/deny') && opts?.method === 'POST') return reply({ redirectTo: 'https://claude.ai/cb?error=access_denied' });
      return reply(consent);
    });

    await screen.findByText('Claude (claude.ai) muốn dùng tài khoản MONSPORT của bạn');
    fireEvent.click(screen.getByRole('button', { name: 'Từ chối' }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://claude.ai/cb?error=access_denied'));
    expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith('/deny'))).toBe(true);
  });

  it('AC-16: a 410 shows the API message and no "Cho phép" button', async () => {
    const message = 'Yêu cầu đã hết hạn. Nối lại từ Claude';
    setup('USER', () => reply({ message }, 410));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(message);
    expect(screen.queryByRole('button', { name: 'Cho phép' })).toBeNull();
  });

  it('AC-16: a role other than USER sees "Bạn không có quyền làm việc này"', async () => {
    setup('OWNER', () => reply(consent));
    expect(await screen.findByText('Bạn không có quyền làm việc này')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cho phép' })).toBeNull();
  });
});
