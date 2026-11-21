import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as clientModule from '@monsport/client';
import { SessionProvider, useSession } from './session';

vi.mock('@monsport/client', async () => {
  const actual = await vi.importActual<typeof import('@monsport/client')>('@monsport/client');
  return {
    ...actual,
    api: vi.fn(),
    disablePush: vi.fn(() => Promise.resolve()),
    resyncPush: vi.fn(() => Promise.resolve()),
  };
});

function Probe() {
  const { user, login, logout } = useSession();
  return (
    <div>
      <span data-testid="user">{user ? user.id : 'none'}</span>
      <button type="button" onClick={() => login({ id: 'u2', name: 'Bình', role: 'USER' })}>
        switch
      </button>
      <button type="button" onClick={() => void logout()}>
        logout
      </button>
    </div>
  );
}

describe('Mobile SessionProvider Web Push lifecycle', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('calls resyncPush when session loads and when switching users', async () => {
    vi.mocked(clientModule.api).mockResolvedValueOnce({ id: 'u1', name: 'An', role: 'USER' });

    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('u1'));
    expect(clientModule.resyncPush).toHaveBeenCalledWith('u1');

    fireEvent.click(screen.getByRole('button', { name: 'switch' }));
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('u2'));
    expect(clientModule.resyncPush).toHaveBeenCalledWith('u2');
  });

  it('calls disablePush before POST /api/auth/logout and clears session even if disablePush rejects', async () => {
    const order: string[] = [];
    vi.mocked(clientModule.api).mockImplementation((async (path: string) => {
      if (path === '/api/auth/me') return { id: 'u1', name: 'An', role: 'USER' };
      order.push(path);
      return {};
    }) as typeof clientModule.api);
    vi.mocked(clientModule.disablePush).mockImplementationOnce(async () => {
      order.push('disablePush');
      throw new Error('sw unavailable');
    });

    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('u1'));
    fireEvent.click(screen.getByRole('button', { name: 'logout' }));

    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('none'));
    expect(order).toEqual(['disablePush', '/api/auth/logout']);
  });
});
