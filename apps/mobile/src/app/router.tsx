import { createBrowserRouter } from 'react-router';
import { EmptyState } from '../components/EmptyState.tsx';
import { ToiScreen } from '../features/auth/ToiScreen.tsx';
import { LobbyScreen } from '../features/lobby/LobbyScreen.tsx';
import { MyScreen } from '../features/my/MyScreen.tsx';
import { NotificationsScreen } from '../features/notifications/NotificationsScreen.tsx';
import { RequestsScreen } from '../features/owner/RequestsScreen.tsx';
import { ScheduleScreen } from '../features/owner/ScheduleScreen.tsx';
import { VenueListScreen } from '../features/venues/VenueListScreen.tsx';
import { VenueScreen } from '../features/venues/VenueScreen.tsx';
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
        { path: 'don-vi/:id', element: <VenueScreen /> },
        { path: 'phong-cho', element: <LobbyScreen /> },
        { path: 'lich-cua-toi', element: <MyScreen /> },
        { path: 'thong-bao', element: <NotificationsScreen /> },
        { path: 'toi', element: <ToiScreen /> },
        { path: 'chu-san/yeu-cau', element: <RequestsScreen /> },
        { path: 'chu-san/lich', element: <ScheduleScreen /> },
        { path: 'chu-san/doanh-thu', element: <EmptyTab /> },
      ],
    },
  ],
  { basename: '/app' },
);
