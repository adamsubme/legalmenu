'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { KanbanBoard } from './components/kanban-board';
import { CreateCaseForm } from './components/create-case-form';
import { TasksListSkeleton } from '@/components/ui/skeleton';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { type TaskExt } from './constants';
import type { Task, SSEEvent } from '@/lib/types';
import { useSSE } from '@/hooks/useSSE';
import { api } from '@/lib/api-client';

function CasesContent() {
  const searchParams = useSearchParams();
  const shouldShowCreate = searchParams.get('new') === '1';

  const [tasks, setTasks] = useState<TaskExt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(shouldShowCreate);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

  // SSE hook for real-time task updates
  useSSE();

  const loadTasks = useCallback(async () => {
    try {
      const { items: tasks } = await api.get<{ items: Task[]; count: number }>('/tasks?workspace_id=default');
      const tasksWithAgents: TaskExt[] = tasks.map((t) => ({
        ...t,
        agent_name: t.assigned_agent?.name,
        agent_avatar: t.assigned_agent?.avatar_emoji,
      }));
      setTasks(tasksWithAgents);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle SSE task updates — merge into existing tasks without full reload
  const handleSSEEvent = useCallback((event: SSEEvent) => {
    if (event.type === 'task_updated' && event.payload) {
      const updated = event.payload as Task;
      setTasks((prev) => {
        const exists = prev.some((t) => t.id === updated.id);
        if (exists) {
          return prev.map((t) =>
            t.id === updated.id
              ? { ...t, ...updated, agent_name: updated.assigned_agent?.name, agent_avatar: updated.assigned_agent?.avatar_emoji }
              : t
          );
        }
        return prev;
      });
    }
    if (event.type === 'task_created' && event.payload) {
      const created = event.payload as Task;
      setTasks((prev) => [
        { ...created, agent_name: created.assigned_agent?.name, agent_avatar: created.assigned_agent?.avatar_emoji } as TaskExt,
        ...prev,
      ]);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    async function loadClientsAndProjects() {
      try {
        const [clientsData, projectsData] = await Promise.all([
          api.get<{ id: string; name: string }[]>('/clients'),
          api.get<{ id: string; name: string }[]>('/projects'),
        ]);
        setClients(clientsData.map((c) => ({ id: c.id, name: c.name })));
        setProjects(projectsData.map((p) => ({ id: p.id, name: p.name })));
      } catch (e) {
        console.error('Failed to load clients/projects:', e);
      }
    }
    loadClientsAndProjects();
  }, []);

  const filteredTasks = search
    ? tasks.filter((t) =>
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.description?.toLowerCase().includes(search.toLowerCase())
      )
    : tasks;

  const blockedTasks = tasks.filter((t) => t.status === 'blocked');

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-zinc-800 bg-zinc-950/50 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-8 w-48 bg-zinc-800/50 animate-pulse rounded" />
              <div className="h-4 w-32 bg-zinc-800/50 animate-pulse rounded" />
            </div>
          </div>
          <div className="h-10 w-64 bg-zinc-800/50 animate-pulse rounded" />
        </div>
        <div className="flex-1 p-4">
          <TasksListSkeleton count={6} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-950/50">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Agent Workflow</h1>
            <p className="text-sm text-zinc-400">
              {tasks.length} cases • {blockedTasks.length} blocked
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowCreate(!showCreate)} className="gap-2">
              <Plus className="h-4 w-4" /> New Case
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              placeholder="Search cases..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Create Form */}
        {showCreate && (
          <CreateCaseForm
            clients={clients}
            projects={projects}
            onCancel={() => setShowCreate(false)}
            onSuccess={() => {
              setShowCreate(false);
              loadTasks();
            }}
          />
        )}
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto">
        <KanbanBoard tasks={filteredTasks} onRefresh={loadTasks} />
      </div>
    </div>
  );
}

export default function CasesPage() {
  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div className="flex h-screen items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-400" />
          </div>
        }
      >
        <CasesContent />
      </Suspense>
    </ErrorBoundary>
  );
}
