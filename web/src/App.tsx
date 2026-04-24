import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy } from 'react';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';

import { AuthGuard } from './auth/AuthGuard';
import { PlatformLayout } from './components/layout/PlatformLayout';

const FormsListPage = lazy(() =>
  import('./modules/formularios/FormsListPage').then((m) => ({ default: m.FormsListPage })),
);
const FormPage = lazy(() =>
  import('./modules/formularios/FormPage').then((m) => ({ default: m.FormPage })),
);
const NotFoundPage = lazy(() =>
  import('./modules/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
);
const AdminGuard = lazy(() =>
  import('./modules/admin/AdminGuard').then((m) => ({ default: m.AdminGuard })),
);
const UsersPage = lazy(() =>
  import('./modules/admin/UsersPage').then((m) => ({ default: m.UsersPage })),
);
const UserFormPage = lazy(() =>
  import('./modules/admin/UserFormPage').then((m) => ({ default: m.UserFormPage })),
);
const SubmissionsPage = lazy(() =>
  import('./modules/admin/SubmissionsPage').then((m) => ({ default: m.SubmissionsPage })),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const router = createBrowserRouter([
  {
    element: <AuthGuard />,
    children: [
      {
        element: <PlatformLayout />,
        children: [
          { index: true, element: <Navigate to="/formularios" replace /> },
          { path: 'formularios', element: <FormsListPage /> },
          { path: 'formularios/:slug', element: <FormPage /> },
          {
            path: 'admin',
            element: <AdminGuard />,
            children: [
              { index: true, element: <Navigate to="/admin/users" replace /> },
              { path: 'users', element: <UsersPage /> },
              { path: 'users/new', element: <UserFormPage /> },
              { path: 'users/:id', element: <UserFormPage /> },
              { path: 'auditoria', element: <SubmissionsPage /> },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
