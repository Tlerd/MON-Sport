import { useMemo } from 'react';
import { RouterProvider } from 'react-router';
import { createRouter } from './router.tsx';
import { SessionProvider } from './session.tsx';

/** Composes the features by role via router and shells. */
export function App({ router: customRouter }: { router?: ReturnType<typeof createRouter> } = {}) {
  const activeRouter = useMemo(() => customRouter ?? createRouter(), [customRouter]);

  return (
    <SessionProvider>
      <RouterProvider router={activeRouter} />
    </SessionProvider>
  );
}
