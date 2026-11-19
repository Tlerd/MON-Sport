import { useMemo } from 'react';
import { RouterProvider } from 'react-router';
import { ToastProvider } from '../components/Toast.tsx';
import { createRouter } from './router.tsx';
import { SessionProvider } from './session.tsx';

export function App({ router: customRouter }: { router?: ReturnType<typeof createRouter> } = {}) {
  const activeRouter = useMemo(() => customRouter ?? createRouter(), [customRouter]);

  return (
    <ToastProvider>
      <SessionProvider>
        <RouterProvider router={activeRouter} />
      </SessionProvider>
    </ToastProvider>
  );
}
