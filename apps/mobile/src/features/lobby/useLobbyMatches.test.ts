import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as clientModule from '@monsport/client';
import type { SessionUser } from '@monsport/shared';
import { useLobbyMatches } from './useLobbyMatches.ts';

vi.mock('@monsport/client', async () => {
  const actual = await vi.importActual<typeof import('@monsport/client')>('@monsport/client');
  return { ...actual, api: vi.fn() };
});

const api = () => vi.mocked(clientModule.api);
const feedCalls = () => api().mock.calls.filter(([p]) => p === '/api/matches');
const joinedCalls = () => api().mock.calls.filter(([p]) => p === '/api/matches/joined');

const USER_1: SessionUser = {
  id: '00000000-0000-4000-8000-0000000000a1',
  name: 'An',
  role: 'USER',
};

const USER_2: SessionUser = {
  id: '00000000-0000-4000-8000-0000000000a2',
  name: 'Bình',
  role: 'USER',
};

describe('useLobbyMatches', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    api().mockReset();
  });

  it('makes no request while user is undefined, then requests /api/matches only when user becomes null', async () => {
    api().mockResolvedValue([]);
    const { result, rerender } = renderHook(
      ({ user }: { user: SessionUser | null | undefined }) => useLobbyMatches(user),
      { initialProps: { user: undefined as SessionUser | null | undefined } },
    );

    expect(api()).not.toHaveBeenCalled();

    rerender({ user: null });

    await waitFor(() => expect(result.current.rows).toEqual([]));
    expect(feedCalls()).toHaveLength(1);
    expect(joinedCalls()).toHaveLength(0);
  });

  it('requests the feed again once when switching from one USER account to another USER account', async () => {
    api().mockResolvedValue([]);
    const { result, rerender } = renderHook(
      ({ user }: { user: SessionUser | null | undefined }) => useLobbyMatches(user),
      { initialProps: { user: USER_1 } },
    );

    await waitFor(() => expect(result.current.rows).toEqual([]));
    expect(feedCalls()).toHaveLength(1);
    expect(joinedCalls()).toHaveLength(1);

    api().mockClear();
    rerender({ user: USER_2 });

    await waitFor(() => expect(result.current.rows).toEqual([]));
    expect(feedCalls()).toHaveLength(1);
    expect(joinedCalls()).toHaveLength(1);
  });
});
