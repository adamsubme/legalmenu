'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AGENT_MAP, timeAgo } from '@/lib/utils';
import {
  Briefcase,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Ban,
  Activity,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import type { Task, Agent } from '@/lib/types';

interface DashboardData {
  tasks: Task[];
  agents: Agent[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>({ tasks: [], agents: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [tasksRes, agentsRes] = await Promise.all([
          fetch('/api/tasks?workspace_id=default'),
          fetch('/api/agents'),
        ]);
        const tasks = tasksRes.ok ? await tasksRes.json() : [];
        const agents = agentsRes.ok ? await agentsRes.json() : [];
        setData({ tasks, agents });
      } catch (e) {
        console.error('Failed to load dashboard:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-400" />
          <p className="text-sm text-zinc-500">Ładowanie...</p>
        </div>
      </div>
    );
  }

  const { tasks, agents } = data;
  const counts = {
    total: tasks.length,
    not_started: tasks.filter((t) => t.status === 'not_started').length,
    in_progress: tasks.filter((t) => t.status === 'in_progress').length,
    blocked: tasks.filter((t) => t.status === 'blocked').length,
    awaiting: tasks.filter((t) => t.status === 'awaiting_approval').length,
    done: tasks.filter((t) => t.status === 'done').length,
  };

  const urgentTasks = tasks.filter(
    (t) => t.priority === 'urgent' && t.status !== 'done'
  );
  const recentTasks = [...tasks]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 8);

  const stats = [
    { label: 'Aktywne sprawy', value: counts.in_progress, icon: Activity, color: 'text-blue-400' },
    { label: 'Do akceptacji', value: counts.awaiting, icon: Clock, color: 'text-amber-400' },
    { label: 'Zablokowane', value: counts.blocked, icon: Ban, color: 'text-red-400' },
    { label: 'Zamknięte', value: counts.done, icon: CheckCircle2, color: 'text-emerald-400' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Przegląd systemu Lex Legal — {counts.total} spraw łącznie
          </p>
        </div>
        <Link
          href="/cases"
          className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          Tablica spraw
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-400">{stat.label}</p>
                  <p className="text-3xl font-bold mt-1">{stat.value}</p>
                </div>
                <stat.icon className={`h-8 w-8 ${stat.color} opacity-80`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Urgent Tasks */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              Pilne
            </CardTitle>
          </CardHeader>
          <CardContent>
            {urgentTasks.length === 0 ? (
              <p className="text-sm text-zinc-500">Brak pilnych spraw</p>
            ) : (
              <div className="space-y-3">
                {urgentTasks.map((task) => (
                  <Link
                    key={task.id}
                    href={`/case/${task.id}`}
                    className="block rounded-lg border border-red-500/20 bg-red-500/5 p-3 hover:bg-red-500/10 transition-colors"
                  >
                    <p className="text-sm font-medium line-clamp-1">{task.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="destructive">urgent</Badge>
                      <span className="text-xs text-zinc-500">{timeAgo(task.updated_at)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Briefcase className="h-4 w-4 text-blue-400" />
              Ostatnia aktywność
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentTasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/case/${task.id}`}
                  className="flex items-center gap-3 rounded-md p-2 hover:bg-zinc-800/50 transition-colors group"
                >
                  <StatusDot status={task.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-blue-400 transition-colors">
                      {task.title}
                    </p>
                  </div>
                  {task.assigned_agent && (
                    <span className="text-xs text-zinc-500">
                      {task.assigned_agent.avatar_emoji} {task.assigned_agent.name}
                    </span>
                  )}
                  <PriorityBadge priority={task.priority} />
                  <span className="text-xs text-zinc-600 w-16 text-right">{timeAgo(task.updated_at)}</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Agent Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Zespół agentów</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-6 gap-3">
            {agents.map((agent) => {
              const info = AGENT_MAP[agent.name.toLowerCase().replace(/ /g, '-')] || {};
              return (
                <Link
                  key={agent.id}
                  href="/agents"
                  className="flex flex-col items-center gap-2 rounded-lg border border-zinc-800 p-4 hover:border-zinc-600 transition-colors"
                >
                  <span className="text-2xl">{agent.avatar_emoji}</span>
                  <span className="text-xs font-medium text-center">{agent.name}</span>
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`h-1.5 w-1.5 rounded-full ${
                        agent.status === 'working'
                          ? 'bg-blue-400 animate-pulse'
                          : agent.status === 'standby'
                          ? 'bg-emerald-400'
                          : 'bg-zinc-600'
                      }`}
                    />
                    <span className="text-[10px] text-zinc-500 capitalize">{agent.status}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    not_started: 'bg-zinc-500',
    in_progress: 'bg-blue-400',
    blocked: 'bg-red-400',
    awaiting_approval: 'bg-amber-400',
    done: 'bg-emerald-400',
  };
  return <div className={`h-2 w-2 rounded-full shrink-0 ${colors[status] || 'bg-zinc-600'}`} />;
}

function PriorityBadge({ priority }: { priority: string }) {
  const variants: Record<string, 'secondary' | 'warning' | 'destructive' | 'info'> = {
    low: 'secondary',
    normal: 'secondary',
    high: 'warning',
    urgent: 'destructive',
  };
  if (priority === 'normal' || priority === 'low') return null;
  return <Badge variant={variants[priority] || 'secondary'}>{priority}</Badge>;
}
