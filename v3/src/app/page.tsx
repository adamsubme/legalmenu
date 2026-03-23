'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AGENT_MAP, STATUS_LABELS, SUB_STATUS_LABELS, timeAgo } from '@/lib/utils';
import { Activity, Clock, Ban, CheckCircle2, AlertTriangle, ArrowRight, Briefcase } from 'lucide-react';
import Link from 'next/link';
import type { Task, Agent } from '@/lib/types';

export default function DashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [tRes, aRes] = await Promise.all([
          fetch('/api/tasks?workspace_id=default'),
          fetch('/api/agents'),
        ]);
        if (tRes.ok) setTasks(await tRes.json());
        if (aRes.ok) setAgents(await aRes.json());
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
    const i = setInterval(load, 30000);
    return () => clearInterval(i);
  }, []);

  if (loading) return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-400" /></div>;

  const c = { active: tasks.filter(t => t.status === 'in_progress').length, review: tasks.filter(t => t.status === 'awaiting_approval').length, blocked: tasks.filter(t => t.status === 'blocked').length, done: tasks.filter(t => t.status === 'done').length };
  const urgent = tasks.filter(t => t.priority === 'urgent' && t.status !== 'done');
  const recent = [...tasks].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 8);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-zinc-400 mt-1">Lex Legal overview — {tasks.length} total cases</p>
        </div>
        <Link href="/cases" className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"><span>Case Board</span><ArrowRight className="h-4 w-4" /></Link>
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
                <div className={`h-2 w-2 rounded-full shrink-0 ${{ not_started: 'bg-zinc-500', in_progress: 'bg-blue-400', blocked: 'bg-red-400', awaiting_approval: 'bg-amber-400', done: 'bg-emerald-400' }[t.status] || 'bg-zinc-600'}`} />
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
