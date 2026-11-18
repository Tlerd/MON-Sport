import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Role, SessionUser } from '@monsport/shared';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthPage } from './pages.tsx';
import { SessionProvider } from './session.tsx';

// Brief F-038, AC-17: a real login on /dang-nhap?tiep=<x>. Only a path of this site is followed.

function Probe() {
  const loc = useLocation();
  return <p data-testid="where">{loc.pathname + loc.search}</p>;
}

function renderLogin(tiep: string, role: Role) {
  const user = { id: '0199a1b2-0000-7000-8000-000000000101', name: 'An', role } as SessionUser;
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url === '/api/auth/login') return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(user) });
      if (url === '/api/auth/me') {
        return Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({ message: 'Chưa đăng nhập' }) });
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
    }),
  );
  render(
    <MemoryRouter initialEntries={[`/dang-nhap?tiep=${encodeURIComponent(tiep)}`]}>
      <SessionProvider>
        <Routes>
          <Route path="/dang-nhap" element={<AuthPage />} />
          <Route path="*" element={<Probe />} />
        </Routes>
      </SessionProvider>
    </MemoryRouter>,
  );
}

async function logIn() {
  fireEvent.change(await screen.findByLabelText('Số điện thoại'), { target: { value: '0900000001' } });
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'mat-khau-thu' } });
  fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
  return (await screen.findByTestId('where')).textContent;
}

describe('AuthPage ?tiep= (F-038)', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('AC-17: a login with tiep=/ket-noi-ai/cho-phep?yeu-cau=1 goes to that path', async () => {
    renderLogin('/ket-noi-ai/cho-phep?yeu-cau=1', 'USER');
    expect(await logIn()).toBe('/ket-noi-ai/cho-phep?yeu-cau=1');
  });

  it.each(['https://la.example', '//la.example', '/\\la.example'])(
    'AC-17: a login with tiep=%s goes to the default page of the role',
    async (tiep) => {
      renderLogin(tiep, 'OWNER');
      expect(await logIn()).toBe('/chu-san/tong-quan');
    },
  );
});
