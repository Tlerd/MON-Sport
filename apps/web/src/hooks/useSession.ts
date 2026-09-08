import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { SessionUser } from '@monsport/shared';
import { fetchSession } from '../api/auth';

export const SESSION_QUERY_KEY = ['session'] as const;

export function useSession(): UseQueryResult<SessionUser | null> {
  return useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: fetchSession,
  });
}
