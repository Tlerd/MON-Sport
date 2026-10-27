import { createBrowserRouter } from 'react-router';
import { EmptyState } from '../components/EmptyState.tsx';
import { ToiScreen } from '../features/auth/ToiScreen.tsx';
import { VenueListScreen } from '../features/venues/VenueListScreen.tsx';
import { App } from './App.tsx';

function EmptyTab() {
  return <EmptyState message="Sắp có" />;
}

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <App />,
      children: [
        { index: true, element: <VenueListScreen /> },
        { path: 'phong-cho', element: <EmptyTab /> },
        { path: 'lich-cua-toi', element: <EmptyTab /> },
        { path: 'thong-bao', element: <EmptyTab /> },
        { path: 'toi', element: <ToiScreen /> },
        { path: 'chu-san/yeu-cau', element: <EmptyTab /> },
        { path: 'chu-san/lich', element: <EmptyTab /> },
        { path: 'chu-san/doanh-thu', element: <EmptyTab /> },
      ],
    },
  ],
  { basename: '/app' },
);
