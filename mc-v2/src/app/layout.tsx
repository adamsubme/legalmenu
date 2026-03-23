import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/layout/Sidebar';

export const metadata: Metadata = {
  title: 'Lex Legal — Dashboard',
  description: 'AI Legal Team Management',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" className="dark">
      <body>
        <Sidebar />
        <main className="pl-56 min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
