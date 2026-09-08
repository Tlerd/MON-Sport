import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchCandidates, login } from '../api/auth';
import { SESSION_QUERY_KEY } from '../hooks/useSession';
import { vi, roleLabel } from '../i18n/vi';

export function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const candidatesQuery = useQuery({ queryKey: ['auth-candidates'], queryFn: fetchCandidates });
  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: (user) => {
      queryClient.setQueryData(SESSION_QUERY_KEY, user);
      void navigate('/ho-so');
    },
  });

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-2xl font-bold">{vi.login.title}</h1>

      {candidatesQuery.isLoading && <p>{vi.common.loading}</p>}
      {candidatesQuery.isError && <p className="text-red-600">{vi.common.error}</p>}

      <ul className="flex flex-col gap-2">
        {candidatesQuery.data?.map((candidate) => (
          <li key={candidate.id}>
            <button
              type="button"
              onClick={() => {
                loginMutation.mutate(candidate.zaloId);
              }}
              disabled={loginMutation.isPending}
              className="w-full rounded border border-slate-300 px-4 py-2 text-left hover:bg-slate-100"
            >
              <span className="font-medium">{candidate.name}</span>
              <span className="ml-2 text-sm text-slate-500">{roleLabel[candidate.role]}</span>
            </button>
          </li>
        ))}
      </ul>

      {loginMutation.isError && <p className="mt-2 text-red-600">{vi.login.error}</p>}
    </main>
  );
}
