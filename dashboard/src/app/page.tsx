'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AGENT_MAP, STATUS_LABELS, SUB_STATUS_LABELS, timeAgo } from '@/lib/utils';
import { useSSE } from '@/hooks/useSSE';
import { Activity, Clock, Ban, CheckCircle2, AlertTriangle, ArrowRight, Briefcase, Plus, UserPlus, FolderPlus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Task, Agent, SSEEvent, TaskStatus } from '@/lib/types';
import { api } from '@/lib/api-client';

const STATUS_COLORS: Record<TaskStatus, string> = {
  not_started: 'bg-zinc-500',
  in_progress: 'bg-blue-400',
  intake: 'bg-purple-400',
  research: 'bg-cyan-400',
  drafting: 'bg-violet-400',
  review: 'bg-amber-400',
  testing: 'bg-orange-400',
  client_input: 'bg-teal-400',
  awaiting_approval: 'bg-amber-400',
  done: 'bg-emerald-400',
  cancelled: 'bg-zinc-600',
  blocked: 'bg-red-400',
  planning: 'bg-pink-400',
};

function StatusDot({ status }: { status: TaskStatus }) {
  return <div className={`h-2 w-2 rounded-full shrink-0 ${STATUS_COLORS[status] ?? 'bg-zinc-600'}`} />;
}

export default function DashboardPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  // SSE for real-time task updates (reduces polling dependency)
  const handleSSE = useCallback((event: SSEEvent) => {
    if (event.type === 'task_updated' && event.payload) {
      const updated = event.payload as Task;
      setTasks(prev => {
        const exists = prev.some(t => t.id === updated.id);
        if (exists) {
          return prev.map(t => t.id === updated.id ? updated : t);
        }
        return prev;
      });
    }
    if (event.type === 'task_created' && event.payload) {
      setTasks(prev => [event.payload as Task, ...prev]);
    }
  }, []);

  useSSE(handleSSE);

  const load = useCallback(async () => {
    try {
      const [{ items: tasks }, agents] = await Promise.all([
        api.get<{ items: Task[]; count: number }>('/tasks?workspace_id=default'),
        api.get<Agent[]>('/agents'),
      ]);
      setTasks(tasks);
      setAgents(agents);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2" style={{ borderColor: 'var(--mc-border)', borderTopColor: 'var(--mc-accent)' }} /></div>;

  const c = { active: tasks.filter(t => t.status === 'in_progress').length, review: tasks.filter(t => t.status === 'awaiting_approval').length, blocked: tasks.filter(t => t.status === 'blocked').length, done: tasks.filter(t => t.status === 'done').length };
  const urgent = tasks.filter(t => t.priority === 'urgent' && t.status !== 'done');
  const recent = [...tasks].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 8);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--mc-text-secondary)' }}>Lex Legal overview — {tasks.length} total cases</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => router.push('/clients?new=1')}>
            <UserPlus className="h-4 w-4 mr-2" />New Client
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push('/projects?new=1')}>
            <FolderPlus className="h-4 w-4 mr-2" />New Project
          </Button>
          <Button size="sm" onClick={() => router.push('/cases?new=1')}>
            <Plus className="h-4 w-4 mr-2" />New Case
          </Button>
          <Link href="/cases" className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 ml-2"><span>Case Board</span><ArrowRight className="h-4 w-4" /></Link>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[{ l: 'Active', v: c.active, icon: Activity, cl: 'text-blue-400' }, { l: 'Awaiting Review', v: c.review, icon: Clock, cl: 'text-amber-400' }, { l: 'Blocked', v: c.blocked, icon: Ban, cl: 'text-red-400' }, { l: 'Done', v: c.done, icon: CheckCircle2, cl: 'text-emerald-400' }].map(s => (
          <Card key={s.l}><CardContent className="p-5"><div className="flex items-center justify-between"><div><p className="text-sm text-zinc-400">{s.l}</p><p className="text-3xl font-bold mt-1">{s.v}</p></div><s.icon className={`h-8 w-8 ${s.cl} opacity-80`} /></div></CardContent></Card>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <Card className="col-span-1">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-red-400" />Urgent</CardTitle></CardHeader>
          <CardContent>
            {urgent.length === 0 ? <p className="text-sm text-zinc-500">No urgent cases</p> : (
              <div className="space-y-3">{urgent.map(t => (
                <Link key={t.id} href={`/case/${t.id}`} className="block rounded-lg border border-red-500/20 bg-red-500/5 p-3 hover:bg-red-500/10 transition-colors">
                  <p className="text-sm font-medium line-clamp-1">{t.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="destructive">urgent</Badge>
                    {(t as Task & { sub_status?: string }).sub_status && <Badge variant="warning">{SUB_STATUS_LABELS[(t as Task & { sub_status?: string }).sub_status!] || (t as Task & { sub_status?: string }).sub_status}</Badge>}
                    <span className="text-xs text-zinc-500">{timeAgo(t.updated_at)}</span>
                  </div>
                </Link>
              ))}</div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Briefcase className="h-4 w-4 text-blue-400" />Recent Activity</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1">{recent.map(t => (
              <Link key={t.id} href={`/case/${t.id}`} className="flex items-center gap-3 rounded-md p-2 hover:bg-zinc-800/50 transition-colors group">
                <StatusDot status={t.status} />
                <span className="text-sm font-medium truncate flex-1 group-hover:text-blue-400 transition-colors">{t.title}</span>
                {t.assigned_agent && <span className="text-xs text-zinc-500">{t.assigned_agent.avatar_emoji} {t.assigned_agent.name}</span>}
                {t.priority === 'urgent' && <Badge variant="destructive">urgent</Badge>}
                {t.priority === 'high' && <Badge variant="warning">high</Badge>}
                <span className="text-xs text-zinc-600 w-16 text-right">{timeAgo(t.updated_at)}</span>
              </Link>
            ))}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Agent Team</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-6 gap-3">{agents.map(a => (
            <Link key={a.id} href={`/agents/${a.name.toLowerCase().replace(/ /g, '-')}`} className="flex flex-col items-center gap-2 rounded-lg border border-zinc-800 p-4 hover:border-zinc-600 transition-colors">
              <span className="text-2xl">{a.avatar_emoji}</span>
              <span className="text-xs font-medium text-center">{a.name}</span>
              <div className="flex items-center gap-1.5">
                <div className={`h-1.5 w-1.5 rounded-full ${a.status === 'working' ? 'bg-blue-400 animate-pulse' : a.status === 'standby' ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                <span className="text-[10px] text-zinc-500 capitalize">{a.status}</span>
              </div>
            </Link>
          ))}</div>
        </CardContent>
      </Card>
    </div>
  );
}
