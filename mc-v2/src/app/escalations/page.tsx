'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { timeAgo } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, Clock, ArrowRight, Bell } from 'lucide-react';
import Link from 'next/link';
import type { Task } from '@/lib/types';

export default function EscalationsPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/tasks?workspace_id=default');
        if (res.ok) {
          const data = await res.json();
          setTasks(data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  const escalated = tasks.filter(
    (t) => t.status === 'awaiting_approval' || t.status === 'blocked' || t.priority === 'urgent'
  );
  const blocked = escalated.filter((t) => t.status === 'blocked');
  const awaiting = escalated.filter((t) => t.status === 'awaiting_approval');
  const urgent = escalated.filter((t) => t.priority === 'urgent' && t.status !== 'done');

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-400" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Eskalacje</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Sprawy wymagające ludzkiej decyzji — {escalated.length} aktywnych
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="border-red-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div>
              <p className="text-2xl font-bold">{blocked.length}</p>
              <p className="text-xs text-zinc-500">Zablokowane</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-amber-400" />
            <div>
              <p className="text-2xl font-bold">{awaiting.length}</p>
              <p className="text-xs text-zinc-500">Do akceptacji</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-orange-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <Bell className="h-5 w-5 text-orange-400" />
            <div>
              <p className="text-2xl font-bold">{urgent.length}</p>
              <p className="text-xs text-zinc-500">Pilne</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        {escalated.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-12">
              <CheckCircle2 className="h-10 w-10 text-emerald-400 mb-3" />
              <p className="text-sm font-medium">Brak eskalacji</p>
              <p className="text-xs text-zinc-500 mt-1">Wszystkie sprawy pod kontrolą</p>
            </CardContent>
          </Card>
        ) : (
          escalated.map((task) => (
            <Card key={task.id} className={task.priority === 'urgent' ? 'border-red-500/20' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="mt-0.5">
                    {task.status === 'blocked' ? (
                      <AlertTriangle className="h-5 w-5 text-red-400" />
                    ) : task.priority === 'urgent' ? (
                      <Bell className="h-5 w-5 text-orange-400" />
                    ) : (
                      <Clock className="h-5 w-5 text-amber-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Link href={`/case/${task.id}`} className="text-sm font-medium hover:text-blue-400 transition-colors">
                        {task.title}
                      </Link>
                      <Badge variant={task.status === 'blocked' ? 'destructive' : 'warning'}>
                        {task.status === 'blocked' ? 'zablokowana' : 'do akceptacji'}
                      </Badge>
                      {task.priority === 'urgent' && <Badge variant="destructive">pilne</Badge>}
                    </div>
                    {task.description && (
                      <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{task.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      {task.assigned_agent && (
                        <span className="text-xs text-zinc-500">
                          {task.assigned_agent.avatar_emoji} {task.assigned_agent.name}
                        </span>
                      )}
                      <span className="text-xs text-zinc-600">{timeAgo(task.updated_at)}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => {}}>
                      Akceptuj
                    </Button>
                    <Link href={`/case/${task.id}`}>
                      <Button size="sm" variant="ghost">
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
