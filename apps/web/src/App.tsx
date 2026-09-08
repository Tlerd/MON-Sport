import { Link, Outlet } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { logout } from './api/auth';
import { SESSION_QUERY_KEY, useSession } from './hooks/useSession';
import { vi } from './i18n/vi';

export function App() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  async function handleLogout(): Promise<void> {
    await logout();
    queryClient.setQueryData(SESSION_QUERY_KEY, null);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <Link to="/" className="text-lg font-bold">
          {vi.appTitle}
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link to="/ho-so">{vi.nav.profile}</Link>
          {session ? (
            <>
              <span className="text-slate-500">{vi.nav.loggedInAs(session.name)}</span>
              <button
                type="button"
                onClick={() => {
                  void handleLogout();
                }}
                className="text-red-600"
              >
                {vi.nav.logout}
              </button>
            </>
          ) : (
            <Link to="/dang-nhap">{vi.nav.login}</Link>
          )}
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
