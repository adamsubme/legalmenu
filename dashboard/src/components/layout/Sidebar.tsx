'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Kanban, Users, AlertTriangle, FileText,
  BookOpen, DollarSign, Settings, Scale, MessageSquare, LogOut,
  UserCircle, FolderOpen,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Cases', href: '/cases', icon: Kanban },
  { name: 'Clients', href: '/clients', icon: UserCircle },
  { name: 'Projects', href: '/projects', icon: FolderOpen },
  { name: 'Agents', href: '/agents', icon: Users },
  { name: 'Escalations', href: '/escalations', icon: AlertTriangle },
  { name: 'Communications', href: '/communications', icon: MessageSquare },
  { name: 'Documents', href: '/documents', icon: FileText },
  { name: 'Knowledge Base', href: '/knowledge', icon: BookOpen },
  { name: 'Costs', href: '/costs', icon: DollarSign },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-56 flex-col border-r border-zinc-800 bg-zinc-950">
      <div className="flex h-14 items-center gap-2.5 border-b border-zinc-800 px-4">
        <Scale className="h-5 w-5 text-blue-400" />
        <span className="text-sm font-bold tracking-tight text-zinc-100">Lex Legal</span>
        <span className="ml-auto rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-400">v3</span>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {navigation.map((item) => {
          const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
                isActive
                  ? 'bg-zinc-800 text-zinc-100 font-medium'
                  : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-800 px-2 py-3">
        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
            pathname === '/settings' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
          Settings
        </Link>

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-zinc-500 hover:bg-zinc-900 hover:text-red-400 transition-colors mt-0.5"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign Out
        </button>

        <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-zinc-400">Gateway online</span>
          </div>
          <p className="mt-1 text-[10px] text-zinc-500 font-mono">6 agents active</p>
        </div>
      </div>
    </aside>
  );
}
