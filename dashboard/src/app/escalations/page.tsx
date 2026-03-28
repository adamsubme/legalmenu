'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SUB_STATUS_LABELS, timeAgo, STATUS_LABELS } from '@/lib/utils';
import { AlertTriangle, MessageSquare, ArrowRight, Ban, Clock, HelpCircle, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import type { Task } from '@/lib/types';
import { api } from '@/lib/api-client';

type TaskExt = Task & { sub_status?: string };

export default function EscalationsPage() {
  const [tasks, setTasks] = useState<TaskExt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { items: tasks } = await api.get<{ items: TaskExt[]; count: number }>('/tasks?workspace_id=default');
        setTasks(tasks);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
    const i = setInterval(load, 15000);
    return () => clearInterval(i);
  }, []);

  const blockedTasks = tasks.filter(t => t.status === 'blocked');
  const waitingClient = blockedTasks.filter(t => t.sub_status === 'waiting_client');
  const waitingDocs = blockedTasks.filter(t => t.sub_status === 'waiting_documents');
  const internalBlocks = blockedTasks.filter(t => t.sub_status === 'internal' || !t.sub_status);
  const urgentTasks = tasks.filter(t => t.priority === 'urgent' && t.status !== 'done');

  const unblock = async (taskId: string) => {
    try {
      await api.patch(`/tasks/${taskId}`, { status: 'in_progress', sub_status: null });
      const { items: tasks } = await api.get<{ items: TaskExt[]; count: number }>('/tasks?workspace_id=default');
      setTasks(tasks);
    } catch (e) { console.error(e); }
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-400" /></div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Escalations</h1>
        <p className="text-sm text-zinc-400 mt-1">{blockedTasks.length} blocked cases, {urgentTasks.length} urgent items</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { l: 'Blocked', v: blockedTasks.length, icon: Ban, cl: 'text-red-400' },
          { l: 'Waiting Client', v: waitingClient.length, icon: Clock, cl: 'text-amber-400' },
          { l: 'Waiting Docs', v: waitingDocs.length, icon: HelpCircle, cl: 'text-orange-400' },
          { l: 'Internal', v: internalBlocks.length, icon: AlertTriangle, cl: 'text-yellow-400' },
        ].map(s => (
          <Card key={s.l}><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-zinc-400">{s.l}</p><p className="text-2xl font-bold mt-1">{s.v}</p></div><s.icon className={`h-6 w-6 ${s.cl} opacity-80`} /></div></CardContent></Card>
        ))}
      </div>

      {waitingClient.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4 text-amber-400" />
              Questions to Client
              <Badge variant="warning">{waitingClient.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {waitingClient.map(t => (
              <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <Link href={`/case/${t.id}`} className="text-sm font-medium hover:text-blue-400 transition-colors line-clamp-1">{t.title}</Link>
                  <p className="text-xs text-zinc-500 mt-0.5">{t.description ? t.description.slice(0, 100) + '...' : 'No description'} · {timeAgo(t.updated_at)}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => unblock(t.id)}><CheckCircle2 className="h-3 w-3 mr-1" />Unblock</Button>
                  <Link href={`/case/${t.id}`}><Button size="sm"><ArrowRight className="h-3 w-3" /></Button></Link>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {waitingDocs.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><HelpCircle className="h-4 w-4 text-orange-400" />Waiting for Documents<Badge variant="warning">{waitingDocs.length}</Badge></CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {waitingDocs.map(t => (
              <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg border border-orange-500/20 bg-orange-500/5">
                <HelpCircle className="h-4 w-4 text-orange-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <Link href={`/case/${t.id}`} className="text-sm font-medium hover:text-blue-400 transition-colors line-clamp-1">{t.title}</Link>
                  <p className="text-xs text-zinc-500 mt-0.5">{timeAgo(t.updated_at)}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => unblock(t.id)}><CheckCircle2 className="h-3 w-3 mr-1" />Unblock</Button>
                  <Link href={`/case/${t.id}`}><Button size="sm"><ArrowRight className="h-3 w-3" /></Button></Link>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {internalBlocks.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-yellow-400" />Internal Blocks<Badge variant="warning">{internalBlocks.length}</Badge></CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {internalBlocks.map(t => (
              <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg border border-zinc-800">
                <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <Link href={`/case/${t.id}`} className="text-sm font-medium hover:text-blue-400 transition-colors">{t.title}</Link>
                  <p className="text-xs text-zinc-500 mt-0.5">{timeAgo(t.updated_at)}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => unblock(t.id)}><CheckCircle2 className="h-3 w-3 mr-1" />Unblock</Button>
                  <Link href={`/case/${t.id}`}><Button size="sm"><ArrowRight className="h-3 w-3" /></Button></Link>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {blockedTasks.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-400/50 mb-3" />
            <p className="text-lg font-medium text-zinc-300">No Escalations</p>
            <p className="text-sm text-zinc-500 mt-1">All processes are running smoothly</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
