'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';

const AUTH_PATHS = ['/login', '/register'];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuth = AUTH_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));

  return (
    <>
      {!isAuth && <Sidebar />}
      <main className={isAuth ? 'min-h-screen' : 'pl-56 min-h-screen'}>
        {children}
      </main>
    </>
  );
}
