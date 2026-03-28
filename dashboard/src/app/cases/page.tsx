'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SUB_STATUS_LABELS, timeAgo } from '@/lib/utils';
import {
  Plus,
  Search,
  AlertTriangle,
  Clock,
  X,
  Upload,
  Link2,
  FileText,
  Briefcase,
  Scale,
  Shield,
  Gavel,
  FileCheck,
  Users,
  Search as SearchIcon,
  Building,
  ClipboardCheck,
  MessageSquare,
} from 'lucide-react';
import Link from 'next/link';
import type { Task, TaskStatus } from '@/lib/types';

const COLUMNS: { id: TaskStatus; label: string; color: string; dot: string }[] = [
  { id: 'not_started', label: 'New', color: 'border-t-zinc-500', dot: 'bg-zinc-500' },
  { id: 'in_progress', label: 'In Progress', color: 'border-t-blue-500', dot: 'bg-blue-500' },
  { id: 'blocked', label: 'Blocked', color: 'border-t-red-500', dot: 'bg-red-500' },
  { id: 'awaiting_approval', label: 'Awaiting Review', color: 'border-t-amber-500', dot: 'bg-amber-500' },
  { id: 'done', label: 'Done', color: 'border-t-emerald-500', dot: 'bg-emerald-500' },
];

const CASE_TYPES = [
  { id: 'analysis', label: 'Analysis', icon: SearchIcon, color: 'text-blue-400' },
  { id: 'contract', label: 'Contract', icon: FileText, color: 'text-emerald-400' },
  { id: 'regulation', label: 'Regulation', icon: Scale, color: 'text-purple-400' },
  { id: 'checklist', label: 'Procedure / Checklist', icon: ClipboardCheck, color: 'text-cyan-400' },
  { id: 'letter', label: 'Letter / Notice', icon: FileCheck, color: 'text-amber-400' },
  { id: 'lawsuit', label: 'Lawsuit', icon: Gavel, color: 'text-red-400' },
  { id: 'corporate', label: 'Corporate', icon: Building, color: 'text-orange-400' },
  { id: 'negotiation', label: 'Negotiation', icon: Users, color: 'text-pink-400' },
  { id: 'due_diligence', label: 'Due Diligence', icon: Shield, color: 'text-indigo-400' },
] as const;

type TaskExt = Task & { sub_status?: string | null; telegram_sender_name?: string | null };

function bucketStatus(status: string): TaskStatus {
  const allowed: TaskStatus[] = ['not_started', 'in_progress', 'done', 'blocked', 'awaiting_approval'];
  if (allowed.includes(status as TaskStatus)) return status as TaskStatus;
  return 'not_started';
}

interface PendingAttachment {
  id: string;
  type: 'file' | 'link';
  name: string;
  file?: File;
  url?: string;
}

export default function CasesPage() {
  const [tasks, setTasks] = useState<TaskExt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState('normal');
  const [newType, setNewType] = useState('');
  const [newLink, setNewLink] = useState('');
  const [newClientId, setNewClientId] = useState('');
  const [newProjectId, setNewProjectId] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [creating, setCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

  const loadTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks?workspace_id=default', { credentials: 'include' });
      if (res.ok) setTasks(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
    const i = setInterval(loadTasks, 15000);
    return () => clearInterval(i);
  }, [loadTasks]);

  useEffect(() => {
    async function loadClientsAndProjects() {
      try {
        const [clientsRes, projectsRes] = await Promise.all([
          fetch('/api/clients', { credentials: 'include' }),
          fetch('/api/projects', { credentials: 'include' }),
        ]);
        if (clientsRes.ok) {
          const data = await clientsRes.json();
          setClients(data.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
        }
        if (projectsRes.ok) {
          const data = await projectsRes.json();
          setProjects(data.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })));
        }
      } catch (e) {
        console.error('Failed to load clients/projects:', e);
      }
    }
    loadClientsAndProjects();
  }, []);

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const taskId = result.draggableId;
    const newStatus = result.destination.droppableId as TaskStatus;
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
        credentials: 'include',
      });
    } catch {
      loadTasks();
    }
  };

  const addFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setPendingAttachments((prev) => [...prev, { id: crypto.randomUUID(), type: 'file', name: file.name, file }]);
    }
    e.target.value = '';
  };

  const addLink = () => {
    if (!newLink.trim()) return;
    setPendingAttachments((prev) => [...prev, { id: crypto.randomUUID(), type: 'link', name: newLink, url: newLink }]);
    setNewLink('');
  };

  const removeAttachment = (id: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const typeLabel = CASE_TYPES.find((t) => t.id === newType)?.label;
      const desc = [newType ? `**Type:** ${typeLabel}` : '', newDesc].filter(Boolean).join('\n\n');

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: newTitle,
          description: desc,
          priority: newPriority,
          workspace_id: 'default',
          client_id: newClientId || undefined,
          project_id: newProjectId || undefined,
        }),
      });

      if (res.ok) {
        const task = await res.json();

        for (const att of pendingAttachments) {
          if (att.type === 'file' && att.file) {
            const fd = new FormData();
            fd.append('file', att.file);
            fd.append('taskId', task.id);
            const uploadRes = await fetch('/api/attachments/upload', { method: 'POST', body: fd, credentials: 'include' });
            if (uploadRes.ok) {
              const uploadData = await uploadRes.json();
              await fetch(`/api/tasks/${task.id}/attachments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  attachment_type: 'file',
                  title: att.name,
                  file_path: uploadData.file_path,
                  file_name: uploadData.file_name,
                  file_size: uploadData.file_size,
                  file_mime: uploadData.file_mime,
                }),
                credentials: 'include',
              });
            }
          } else if (att.type === 'link' && att.url) {
            await fetch(`/api/tasks/${task.id}/attachments`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ attachment_type: 'link', title: att.url, url: att.url }),
              credentials: 'include',
            });
          }
        }

        setNewTitle('');
        setNewDesc('');
        setNewPriority('normal');
        setNewType('');
        setNewClientId('');
        setNewProjectId('');
        setPendingAttachments([]);
        setShowCreate(false);
        loadTasks();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setNewTitle('');
    setNewDesc('');
    setNewPriority('normal');
    setNewType('');
    setNewClientId('');
    setNewProjectId('');
    setPendingAttachments([]);
    setShowCreate(false);
  };

  const filtered = tasks.filter(
    (t) =>
      !search ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      (t.description?.toLowerCase() || '').includes(search.toLowerCase())
  );

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-400" />
      </div>
    );

  return (
    <div className="flex h-screen flex-col">
      <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-3">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">Cases</h1>
          <span className="text-sm text-zinc-500">{tasks.length} total</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-64 pl-8 text-xs"
            />
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-3.5 w-3.5" />
            New Case
          </Button>
        </div>
      </div>

      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) resetForm();
          }}
        >
          <Card className="animate-slide-in mx-4 max-h-[90vh] w-full max-w-2xl overflow-y-auto border-zinc-700">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Briefcase className="h-5 w-5 text-blue-400" />
                  New Case
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={resetForm}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                  Title <span className="text-red-400">*</span>
                </label>
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. NDA Review — Acme Corp"
                  className="text-sm"
                  autoFocus
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-zinc-400">Case Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {CASE_TYPES.map((ct) => (
                    <button
                      key={ct.id}
                      type="button"
                      onClick={() => setNewType(newType === ct.id ? '' : ct.id)}
                      className={`flex items-center gap-2 rounded-lg border p-2.5 text-left text-xs font-medium transition-all ${
                        newType === ct.id
                          ? 'border-blue-500/50 bg-blue-500/10 text-blue-300'
                          : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                      }`}
                    >
                      <ct.icon className={`h-4 w-4 shrink-0 ${newType === ct.id ? 'text-blue-400' : ct.color}`} />
                      {ct.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Description</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Describe the case, key facts, client instructions, relevant context..."
                  className="min-h-[120px] w-full resize-y rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-400">Priority</label>
                <div className="flex gap-2">
                  {[
                    { id: 'low', label: 'Low', style: 'border-zinc-700 text-zinc-400' },
                    { id: 'normal', label: 'Normal', style: 'border-zinc-700 text-zinc-300' },
                    { id: 'high', label: 'High', style: 'border-amber-500/30 text-amber-400' },
                    { id: 'urgent', label: 'Urgent', style: 'border-red-500/30 text-red-400' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setNewPriority(p.id)}
                      className={`flex-1 rounded-md border py-1.5 text-xs font-medium transition-all ${
                        newPriority === p.id
                          ? p.id === 'urgent'
                            ? 'border-red-500/50 bg-red-500/15 text-red-300'
                            : p.id === 'high'
                              ? 'border-amber-500/50 bg-amber-500/15 text-amber-300'
                              : 'border-blue-500/40 bg-blue-500/10 text-blue-300'
                          : `bg-zinc-900/50 ${p.style} hover:bg-zinc-800`
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-400">Client</label>
                  <select
                    value={newClientId}
                    onChange={(e) => {
                      setNewClientId(e.target.value);
                      if (!e.target.value) setNewProjectId('');
                    }}
                    className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                  >
                    <option value="">No client</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-zinc-400">Project</label>
                  <select
                    value={newProjectId}
                    onChange={(e) => setNewProjectId(e.target.value)}
                    className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                  >
                    <option value="">No project</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-zinc-400">Documents &amp; Links</label>
                <div className="mb-3 flex gap-2">
                  <input type="file" ref={fileInputRef} className="hidden" multiple onChange={addFile} />
                  <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-3.5 w-3.5" />
                    Upload Files
                  </Button>
                  <div className="flex flex-1 gap-2">
                    <Input
                      value={newLink}
                      onChange={(e) => setNewLink(e.target.value)}
                      placeholder="Paste a URL..."
                      className="h-8 flex-1 text-xs"
                      onKeyDown={(e) => e.key === 'Enter' && addLink()}
                    />
                    <Button size="sm" variant="outline" onClick={addLink} disabled={!newLink.trim()}>
                      <Link2 className="h-3.5 w-3.5" />
                      Add
                    </Button>
                  </div>
                </div>

                {pendingAttachments.length > 0 && (
                  <div className="space-y-1.5">
                    {pendingAttachments.map((att) => (
                      <div key={att.id} className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-1.5">
                        {att.type === 'file' ? (
                          <FileText className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                        ) : (
                          <Link2 className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                        )}
                        <span className="flex-1 truncate text-xs text-zinc-300">{att.name}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {att.type}
                        </Badge>
                        <button
                          type="button"
                          onClick={() => removeAttachment(att.id)}
                          className="text-zinc-600 transition-colors hover:text-red-400"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 border-t border-zinc-800 pt-2">
                <Button variant="ghost" onClick={resetForm}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={!newTitle.trim() || creating}>
                  {creating ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Create Case
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex-1 overflow-x-auto p-4">
          <div className="flex h-full min-w-max gap-4">
            {COLUMNS.map((col) => {
              const colTasks = filtered.filter((t) => bucketStatus(t.status) === col.id);
              return (
                <div key={col.id} className="flex w-72 shrink-0 flex-col">
                  <div className={`mb-3 flex items-center gap-2 border-t-2 pb-2 pt-2 ${col.color}`}>
                    <div className={`h-2 w-2 rounded-full ${col.dot}`} />
                    <span className="text-sm font-medium text-zinc-300">{col.label}</span>
                    <span className="ml-auto rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-600">{colTasks.length}</span>
                  </div>
                  <Droppable droppableId={col.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 space-y-2 rounded-lg p-1 transition-colors ${snapshot.isDraggingOver ? 'bg-zinc-800/30' : ''}`}
                      >
                        {colTasks.map((task, index) => (
                          <Draggable key={task.id} draggableId={task.id} index={index}>
                            {(prov, snap) => (
                              <div ref={prov.innerRef} {...prov.draggableProps} {...prov.dragHandleProps}>
                                <Link
                                  href={`/case/${task.id}`}
                                  className={`block rounded-lg border border-zinc-800 bg-zinc-900 p-3 transition-all hover:border-zinc-600 ${snap.isDragging ? 'rotate-1 border-zinc-600 shadow-xl shadow-black/50' : ''}`}
                                >
                                  <p className="line-clamp-2 text-sm font-medium text-zinc-200">{task.title}</p>
                                  {task.description && (
                                    <p className="mt-1 line-clamp-1 text-xs text-zinc-500">{task.description}</p>
                                  )}
                                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                                    {task.priority === 'urgent' && (
                                      <Badge variant="destructive" className="gap-1">
                                        <AlertTriangle className="h-2.5 w-2.5" />
                                        urgent
                                      </Badge>
                                    )}
                                    {task.priority === 'high' && <Badge variant="warning">high</Badge>}
                                    {task.sub_status && (
                                      <Badge variant={task.sub_status === 'waiting_client' ? 'warning' : 'info'}>
                                        {SUB_STATUS_LABELS[task.sub_status] || task.sub_status}
                                      </Badge>
                                    )}
                                    {task.telegram_sender_name && (
                                      <Badge variant="outline" className="gap-1 text-[10px]">
                                        <MessageSquare className="h-2.5 w-2.5" />
                                        {task.telegram_sender_name}
                                      </Badge>
                                    )}
                                    {task.assigned_agent && (
                                      <span className="text-[10px] text-zinc-500">
                                        {task.assigned_agent.avatar_emoji} {task.assigned_agent.name}
                                      </span>
                                    )}
                                    {task.due_date && (
                                      <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500">
                                        <Clock className="h-2.5 w-2.5" />
                                        {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                      </span>
                                    )}
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
