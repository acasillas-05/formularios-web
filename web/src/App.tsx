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
