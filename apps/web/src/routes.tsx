import { createBrowserRouter } from 'react-router-dom';
import { App } from './App';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { ProfilePage } from './pages/ProfilePage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'dang-nhap', element: <LoginPage /> },
      { path: 'ho-so', element: <ProfilePage /> },
    ],
  },
]);
