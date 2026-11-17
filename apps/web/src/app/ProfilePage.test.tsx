import { cleanup, render, screen } from '@testing-library/react';
import type { Role, SessionUser } from '@monsport/shared';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/Toast.tsx';
import { ProfilePage } from './pages.tsx';
import { SessionProvider } from './session.tsx';

// Brief F-037, AC-13 (QA finding 8): a real render of /ho-so, so the role gate is tested by behavior, not by source text.
function renderAs(role: Role) {
  const user: SessionUser = { id: '0199a1b2-0000-7000-8000-000000000101', name: 'An', role } as SessionUser;
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      const body = url === '/api/auth/me' ? user : url === '/api/me/access-tokens' ? { tokens: [] } : [];
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
    }),
  );
  render(
    <MemoryRouter>
      <ToastProvider>
        <SessionProvider>
          <ProfilePage />
        </SessionProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('ProfilePage (F-037)', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('AC-13: a USER sees "Kết nối AI" above the "Sắp ra mắt" card', async () => {
    renderAs('USER');
    const section = await screen.findByRole('region', { name: 'Kết nối AI' });
    const soon = screen.getByText('Sắp ra mắt');
    expect(section.compareDocumentPosition(soon) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('AC-13: an OWNER does not see "Kết nối AI", and the "Sắp ra mắt" card stays', async () => {
    renderAs('OWNER');
    await screen.findByRole('heading', { name: 'An' });
    expect(screen.getByText('Sắp ra mắt')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Kết nối AI' })).toBeNull();
  });
});
