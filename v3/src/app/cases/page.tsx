'use client';

import { useState, useEffect, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { STATUS_LABELS, SUB_STATUS_LABELS, timeAgo } from '@/lib/utils';
import { Plus, Search, AlertTriangle, Clock } from 'lucide-react';
import Link from 'next/link';
import type { Task, TaskStatus } from '@/lib/types';

const COLUMNS: { id: TaskStatus; label: string; color: string; dot: string }[] = [
  { id: 'not_started', label: 'New', color: 'border-t-zinc-500', dot: 'bg-zinc-500' },
  { id: 'in_progress', label: 'In Progress', color: 'border-t-blue-500', dot: 'bg-blue-500' },
  { id: 'blocked', label: 'Blocked', color: 'border-t-red-500', dot: 'bg-red-500' },
  { id: 'awaiting_approval', label: 'Awaiting Review', color: 'border-t-amber-500', dot: 'bg-amber-500' },
  { id: 'done', label: 'Done', color: 'border-t-emerald-500', dot: 'bg-emerald-500' },
];

type TaskExt = Task & { sub_status?: string };

export default function CasesPage() {
  const [tasks, setTasks] = useState<TaskExt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState('normal');

  const loadTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks?workspace_id=default');
      if (res.ok) setTasks(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadTasks(); const i = setInterval(loadTasks, 15000); return () => clearInterval(i); }, [loadTasks]);

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const taskId = result.draggableId;
    const newStatus = result.destination.droppableId as TaskStatus;
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    try { await fetch(`/api/tasks/${taskId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) }); } catch { loadTasks(); }
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    try {
      const res = await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: newTitle, description: newDesc, priority: newPriority, workspace_id: 'default' }) });
      if (res.ok) { setNewTitle(''); setNewDesc(''); setShowCreate(false); loadTasks(); }
    } catch (e) { console.error(e); }
  };

  const filtered = tasks.filter(t => !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.description?.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-400" /></div>;

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-3">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">Cases</h1>
          <span className="text-sm text-zinc-500">{tasks.length} total</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
            <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 w-64 h-8 text-xs" />
          </div>
          <Button size="sm" onClick={() => setShowCreate(!showCreate)}><Plus className="h-3.5 w-3.5" />New Case</Button>
        </div>
      </div>

      {showCreate && (
        <div className="border-b border-zinc-800 px-6 py-3 bg-zinc-900/50 animate-slide-in">
          <div className="flex gap-3 items-end">
            <div className="flex-1"><label className="text-xs text-zinc-500 mb-1 block">Title</label><Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="e.g. NDA Review — Acme Corp" className="h-8 text-xs" autoFocus onKeyDown={e => e.key === 'Enter' && handleCreate()} /></div>
            <div className="w-64"><label className="text-xs text-zinc-500 mb-1 block">Description</label><Input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Optional description..." className="h-8 text-xs" /></div>
            <div className="w-32"><label className="text-xs text-zinc-500 mb-1 block">Priority</label><select value={newPriority} onChange={e => setNewPriority(e.target.value)} className="h-8 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-300"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>
            <Button size="sm" onClick={handleCreate}>Create</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex-1 overflow-x-auto p-4">
          <div className="flex gap-4 h-full min-w-max">
            {COLUMNS.map(col => {
              const colTasks = filtered.filter(t => t.status === col.id);
              return (
                <div key={col.id} className="flex flex-col w-72 shrink-0">
                  <div className={`flex items-center gap-2 mb-3 pb-2 border-t-2 pt-2 ${col.color}`}>
                    <div className={`h-2 w-2 rounded-full ${col.dot}`} />
                    <span className="text-sm font-medium text-zinc-300">{col.label}</span>
                    <span className="ml-auto text-xs text-zinc-600 bg-zinc-800 rounded-full px-2 py-0.5">{colTasks.length}</span>
                  </div>
                  <Droppable droppableId={col.id}>
                    {(provided, snapshot) => (
                      <div ref={provided.innerRef} {...provided.droppableProps} className={`flex-1 space-y-2 rounded-lg p-1 transition-colors ${snapshot.isDraggingOver ? 'bg-zinc-800/30' : ''}`}>
                        {colTasks.map((task, index) => (
                          <Draggable key={task.id} draggableId={task.id} index={index}>
                            {(prov, snap) => (
                              <div ref={prov.innerRef} {...prov.draggableProps} {...prov.dragHandleProps}>
                                <Link href={`/case/${task.id}`} className={`block rounded-lg border border-zinc-800 bg-zinc-900 p-3 transition-all hover:border-zinc-600 ${snap.isDragging ? 'shadow-xl shadow-black/50 border-zinc-600 rotate-1' : ''}`}>
                                  <p className="text-sm font-medium text-zinc-200 line-clamp-2">{task.title}</p>
                                  {task.description && <p className="text-xs text-zinc-500 mt-1 line-clamp-1">{task.description}</p>}
                                  <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                                    {task.priority === 'urgent' && <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-2.5 w-2.5" />urgent</Badge>}
                                    {task.priority === 'high' && <Badge variant="warning">high</Badge>}
                                    {task.sub_status && <Badge variant={task.sub_status === 'waiting_client' ? 'warning' : 'info'}>{SUB_STATUS_LABELS[task.sub_status] || task.sub_status}</Badge>}
                                    {task.assigned_agent && <span className="text-[10px] text-zinc-500">{task.assigned_agent.avatar_emoji} {task.assigned_agent.name}</span>}
                                    {task.due_date && <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500"><Clock className="h-2.5 w-2.5" />{new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                                    <span className="ml-auto text-[10px] text-zinc-600">{timeAgo(task.updated_at)}</span>
                                  </div>
                                </Link>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </div>
      </DragDropContext>
    </div>
  );
}
