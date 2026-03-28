'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/ThemeProvider';
import {
  LayoutDashboard, Kanban, Users, AlertTriangle, FileText,
  BookOpen, DollarSign, Settings, Scale, MessageSquare, LogOut,
  UserCircle, FolderOpen, Sun, Moon,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';

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
  const { theme, toggleTheme } = useTheme();
  const [agentCount, setAgentCount] = useState(0);
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    async function loadMeta() {
      try {
        const agents = await api.get<{ status: string }[]>('/agents');
        setAgentCount(Array.isArray(agents) ? agents.length : 0);
        const working = Array.isArray(agents) ? agents.filter((a) => a.status === 'working').length : 0;
        setIsOnline(working > 0);
      } catch {
        // silently ignore
      }
    }
    loadMeta();
    const interval = setInterval(loadMeta, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    await api.post('/auth/logout');
    router.push('/login');
    router.refresh();
  };

  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <aside
      className="fixed inset-y-0 left-0 z-50 flex w-56 flex-col border-r"
      style={{
        backgroundColor: 'var(--mc-sidebar-bg)',
        borderColor: 'var(--mc-sidebar-border)',
      }}
    >
      {/* Logo */}
      <div
        className="flex h-14 items-center gap-2.5 border-b px-4"
        style={{ borderColor: 'var(--mc-sidebar-border)' }}
      >
        <Scale className="h-5 w-5" style={{ color: 'var(--mc-accent)' }} />
        <span className="text-sm font-bold tracking-tight" style={{ color: 'var(--mc-sidebar-text)' }}>Lex Legal</span>
        <span
          className="ml-auto rounded px-1.5 py-0.5 text-[10px] font-medium"
          style={{ backgroundColor: 'var(--mc-accent)', color: '#fff', opacity: 0.9 }}
        >
          v3
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {navigation.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
              isActive(item.href)
                ? 'font-medium'
                : ''
            )}
            style={
              isActive(item.href)
                ? { backgroundColor: 'var(--mc-sidebar-active)', color: 'var(--mc-sidebar-text)' }
                : { color: 'var(--mc-nav-text)' }
            }
            onMouseEnter={(e) => {
              if (!isActive(item.href)) {
                e.currentTarget.style.backgroundColor = 'var(--mc-sidebar-hover)';
                e.currentTarget.style.color = 'var(--mc-nav-text-hover)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive(item.href)) {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--mc-nav-text)';
              }
            }}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.name}
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t px-2 py-3 space-y-1" style={{ borderColor: 'var(--mc-sidebar-border)' }}>
        <Link
          href="/settings"
          className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors"
          style={
            pathname === '/settings'
              ? { backgroundColor: 'var(--mc-sidebar-active)', color: 'var(--mc-sidebar-text)' }
              : { color: 'var(--mc-nav-text)' }
          }
          onMouseEnter={(e) => {
            if (pathname !== '/settings') {
              e.currentTarget.style.backgroundColor = 'var(--mc-sidebar-hover)';
              e.currentTarget.style.color = 'var(--mc-nav-text-hover)';
            }
          }}
          onMouseLeave={(e) => {
            if (pathname !== '/settings') {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--mc-nav-text)';
            }
          }}
        >
          <Settings className="h-4 w-4 shrink-0" />
          Settings
        </Link>

        <button
          onClick={toggleTheme}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors"
          style={{ color: 'var(--mc-sidebar-text-muted)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--mc-sidebar-hover)';
            e.currentTarget.style.color = 'var(--mc-nav-text-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--mc-sidebar-text-muted)';
          }}
        >
          {theme === 'dark'
            ? <Sun className="h-4 w-4 shrink-0" />
            : <Moon className="h-4 w-4 shrink-0" />
          }
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors"
          style={{ color: 'var(--mc-sidebar-text-muted)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--mc-sidebar-hover)';
            e.currentTarget.style.color = '#f87171';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--mc-sidebar-text-muted)';
          }}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign Out
        </button>

        {/* Status */}
        <div
          className="mt-3 rounded-md border px-3 py-2"
          style={{
            backgroundColor: 'var(--mc-sidebar-hover)',
            borderColor: 'var(--mc-sidebar-border)',
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: isOnline ? 'var(--mc-accent-green)' : '#71717a' }}
            />
            <span className="text-xs" style={{ color: 'var(--mc-sidebar-text-muted)' }}>
              {isOnline ? 'Gateway online' : 'Gateway offline'}
            </span>
          </div>
          <p
            className="mt-1 text-[10px] font-mono"
            style={{ color: 'var(--mc-sidebar-text-muted)' }}
          >
            {agentCount} agent{agentCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
    </aside>
  );
}
