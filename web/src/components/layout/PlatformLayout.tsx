import { Suspense } from 'react';
import { Outlet } from 'react-router';

import { Spinner } from '../ui/Spinner';
import { Toaster } from '../ui/Toaster';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export function PlatformLayout() {
  return (
    <div className="h-screen flex bg-bg-primary text-text overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-24">
                <Spinner size={28} />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>
      <Toaster />
    </div>
  );
}
