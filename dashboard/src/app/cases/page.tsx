'use client';

import { useState, useEffect, useCallback, Suspense, useRef } from 'react';
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
  Scale,
  Shield,
  Gavel,
  FileCheck,
  Users,
  Building,
  ClipboardCheck,
  MessageSquare,
  Bot,
  FileSearch,
  PenTool,
  Eye,
  MessageCircle,
  CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { Task, TaskStatus } from '@/lib/types';

// Agent workflow stages - Kanban columns
const WORKFLOW_STAGES = [
  { id: 'intake', label: 'Intake', icon: Bot, color: 'border-t-slate-500', dot: 'bg-slate-400' },
  { id: 'research', label: 'Research', icon: FileSearch, color: 'border-t-blue-500', dot: 'bg-blue-400' },
  { id: 'drafting', label: 'Drafting', icon: PenTool, color: 'border-t-purple-500', dot: 'bg-purple-400' },
  { id: 'review', label: 'Internal Review', icon: Eye, color: 'border-t-amber-500', dot: 'bg-amber-400' },
  { id: 'client_input', label: 'Client Input', icon: MessageCircle, color: 'border-t-cyan-500', dot: 'bg-cyan-400' },
  { id: 'done', label: 'Done', icon: CheckCircle2, color: 'border-t-emerald-500', dot: 'bg-emerald-400' },
] as const;

type WorkflowStage = typeof WORKFLOW_STAGES[number]['id'];

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-500/10 text-red-400 border-red-500/30',
  high: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  normal: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
};

const SUB_STATUS_GROUPS: Record<string, { label: string; stages: WorkflowStage[] }> = {
  intake: { label: 'Intake', stages: ['intake'] },
  needs_research: { label: 'Needs Research', stages: ['research'] },
  research_in_progress: { label: 'Research in Progress', stages: ['research'] },
  needs_draft: { label: 'Needs Draft', stages: ['drafting'] },
  drafting_in_progress: { label: 'Drafting in Progress', stages: ['drafting'] },
  needs_review: { label: 'Needs Review', stages: ['review'] },
  review_in_progress: { label: 'Review in Progress', stages: ['review'] },
  needs_client_input: { label: 'Needs Client Input', stages: ['client_input'] },
  client_responded: { label: 'Client Responded', stages: ['drafting'] },
  approved: { label: 'Approved', stages: ['done'] },
  delivered: { label: 'Delivered', stages: ['done'] },
};

type TaskExt = Task & { 
  sub_status?: string | null; 
  agent_name?: string;
  agent_avatar?: string;
};

function getStageFromTask(task: TaskExt): WorkflowStage {
  // If done, show as done
  if (task.status === 'done') return 'done';
  
  // Map sub_status to workflow stage
  if (task.sub_status) {
    const group = SUB_STATUS_GROUPS[task.sub_status];
    if (group) return group.stages[0];
    
    // Fallback mapping for common patterns
    if (task.sub_status.includes('intake')) return 'intake';
    if (task.sub_status.includes('research')) return 'research';
    if (task.sub_status.includes('draft')) return 'drafting';
    if (task.sub_status.includes('review')) return 'review';
    if (task.sub_status.includes('client') || task.sub_status.includes('waiting')) return 'client_input';
  }
  
  // Map status to stage
  switch (task.status) {
    case 'blocked': return 'review'; // Blocked usually during review
    case 'awaiting_approval': return 'client_input';
    case 'in_progress': return 'drafting';
    default: return 'intake';
  }
}

function getTasksByStage(tasks: TaskExt[]): Record<WorkflowStage, TaskExt[]> {
  const grouped: Record<WorkflowStage, TaskExt[]> = {
    intake: [],
    research: [],
    drafting: [],
    review: [],
    client_input: [],
    done: [],
  };
  
  for (const task of tasks) {
    const stage = getStageFromTask(task);
    grouped[stage].push(task);
  }
  
  return grouped;
}

interface PendingAttachment {
  id: string;
  type: 'file' | 'link';
  name: string;
  file?: File;
  url?: string;
}

function CasesContent() {
  const searchParams = useSearchParams();
  const shouldShowCreate = searchParams.get('new') === '1';
  const preselectedProjectId = searchParams.get('project_id') || '';

  const [tasks, setTasks] = useState<TaskExt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(shouldShowCreate);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState('normal');
  const [newType, setNewType] = useState('');
  const [newClientId, setNewClientId] = useState('');
  const [newProjectId, setNewProjectId] = useState(preselectedProjectId);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [creating, setCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

  const loadTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks?workspace_id=default', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        // Enrich with agent info if available
        const tasksWithAgents: TaskExt[] = data.map((t: Task) => ({
          ...t,
          agent_name: t.assigned_agent?.name,
          agent_avatar: t.assigned_agent?.avatar_emoji,
        }));
        setTasks(tasksWithAgents);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
    const i = setInterval(loadTasks, 10000);
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
    const newStage = result.destination.droppableId as WorkflowStage;
    const newStatus = newStage === 'done' ? 'done' : newStage === 'client_input' ? 'awaiting_approval' : 'in_progress';
    
    // Map stage to appropriate sub_status
    let subStatus = '';
    switch (newStage) {
      case 'intake': subStatus = 'intake'; break;
      case 'research': subStatus = 'research_in_progress'; break;
      case 'drafting': subStatus = 'drafting_in_progress'; break;
      case 'review': subStatus = 'needs_review'; break;
      case 'client_input': subStatus = 'needs_client_input'; break;
      case 'done': subStatus = 'approved'; break;
    }
    
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { 
      ...t, 
      status: newStatus as TaskStatus,
      sub_status: subStatus 
    } : t));
    
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, sub_status: subStatus }),
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
  };

  const addLink = () => {
    if (!newLink) return;
    setPendingAttachments((prev) => [...prev, { id: crypto.randomUUID(), type: 'link', name: newLink, url: newLink }]);
    setNewLink('');
  };

  const removeAttachment = (id: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          description: newDesc,
          priority: newPriority,
          task_type: newType || undefined,
          client_id: newClientId || undefined,
          project_id: newProjectId || undefined,
          status: 'not_started',
        }),
        credentials: 'include',
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
              body: JSON.stringify({ attachment_type: 'link', title: att.name, url: att.url }),
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
  };

  const filteredTasks = search
    ? tasks.filter(t => 
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.description?.toLowerCase().includes(search.toLowerCase())
      )
    : tasks;

  const tasksByStage = getTasksByStage(filteredTasks);

  const blockedTasks = tasks.filter(t => t.status === 'blocked');

  if (loading) {
    return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-400" /></div>;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-950/50">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Agent Workflow</h1>
            <p className="text-sm text-zinc-400">{tasks.length} cases • {blockedTasks.length} blocked</p>
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
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Create Form */}
        {showCreate && (
          <Card className="mt-4 border-blue-500/30 bg-blue-500/5">
            <CardContent className="p-4">
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <Input
                    placeholder="Case title *"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    required
                    className="col-span-2"
                  />
                  <select
                    className="h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm"
                    value={newPriority}
                    onChange={e => setNewPriority(e.target.value)}
                  >
                    <option value="low">Low Priority</option>
                    <option value="normal">Normal</option>
                    <option value="high">High Priority</option>
                    <option value="urgent">Urgent</option>
                  </select>
                  <select
                    className="h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm"
                    value={newClientId}
                    onChange={e => setNewClientId(e.target.value)}
                  >
                    <option value="">Select client...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <select
                    className="h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm"
                    value={newProjectId}
                    onChange={e => setNewProjectId(e.target.value)}
                  >
                    <option value="">Select project...</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <Input
                    placeholder="Case type (optional)"
                    value={newType}
                    onChange={e => setNewType(e.target.value)}
                  />
                </div>
                
                <textarea
                  className="w-full h-20 bg-zinc-900 border border-zinc-700 rounded-md p-2 text-sm resize-none"
                  placeholder="Description..."
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                />

                {/* Attachments */}
                <div className="flex flex-wrap gap-2">
                  {pendingAttachments.map(att => (
                    <div key={att.id} className="flex items-center gap-2 bg-zinc-800 rounded px-2 py-1">
                      {att.type === 'file' ? <FileText className="h-4 w-4 text-blue-400" /> : <Link2 className="h-4 w-4 text-cyan-400" />}
                      <span className="text-xs">{att.name}</span>
                      <button type="button" onClick={() => removeAttachment(att.id)} className="text-zinc-500 hover:text-red-400">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <input ref={fileInputRef} type="file" multiple className="hidden" onChange={addFile} />
                    <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="h-4 w-4 mr-2" />Attach
                    </Button>
                    <div className="flex gap-1">
                      <Input
                        placeholder="Paste link..."
                        value={newLink}
                        onChange={e => setNewLink(e.target.value)}
                        className="w-48 h-8 text-sm"
                      />
                      <Button type="button" variant="outline" size="sm" onClick={addLink}>
                        <Link2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" onClick={() => { setShowCreate(false); resetForm(); }}>Cancel</Button>
                    <Button type="submit" disabled={creating}>
                      {creating ? 'Creating...' : 'Create Case'}
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-4 p-4 h-full min-w-max">
            {WORKFLOW_STAGES.map(stage => {
              const StageIcon = stage.icon;
              const stageTasks = tasksByStage[stage.id];
              
              return (
                <div key={stage.id} className="flex flex-col w-72 shrink-0">
                  {/* Column Header */}
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-t-lg border-t-2 ${stage.color} bg-zinc-900/50`}>
                    <StageIcon className="h-4 w-4" />
                    <span className="font-medium text-sm">{stage.label}</span>
                    <Badge variant="outline" className="ml-auto text-xs">{stageTasks.length}</Badge>
                  </div>
                  
                  {/* Column Content */}
                  <Droppable droppableId={stage.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 rounded-b-lg p-2 space-y-2 min-h-32 transition-colors ${
                          snapshot.isDraggingOver ? 'bg-zinc-800/50' : 'bg-zinc-900/20'
                        }`}
                      >
                        {stageTasks.map((task, index) => (
                          <Draggable key={task.id} draggableId={task.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`rounded-lg border border-zinc-700 p-3 transition-all ${
                                  snapshot.isDragging ? 'shadow-lg shadow-black/50 rotate-2 bg-zinc-800' : 'bg-zinc-800/50 hover:bg-zinc-800'
                                }`}
                              >
                                <Link href={`/case/${task.id}`} className="block">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium line-clamp-2">{task.title}</p>
                                      {task.sub_status && (
                                        <Badge variant="secondary" className="mt-1 text-[10px]">
                                          {SUB_STATUS_LABELS[task.sub_status] || task.sub_status}
                                        </Badge>
                                      )}
                                    </div>
                                    {task.agent_avatar && (
                                      <span className="text-lg shrink-0">{task.agent_avatar}</span>
                                    )}
                                  </div>
                                  
                                  <div className="flex items-center gap-2 mt-2">
                                    {task.priority && task.priority !== 'normal' && (
                                      <Badge className={`text-[10px] ${PRIORITY_COLORS[task.priority]}`}>
                                        {task.priority}
                                      </Badge>
                                    )}
                                    {task.assigned_agent && !task.agent_avatar && (
                                      <span className="text-xs text-zinc-500">{task.assigned_agent.name}</span>
                                    )}
                                    <span className="text-[10px] text-zinc-600 ml-auto">{timeAgo(task.updated_at)}</span>
                                  </div>
                                  
                                  {task.client_name && (
                                    <div className="flex items-center gap-1 mt-1 text-[10px] text-zinc-500">
                                      <Users className="h-3 w-3" />
                                      <span className="truncate">{task.client_name}</span>
                                    </div>
                                  )}
                                </Link>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        
                        {stageTasks.length === 0 && (
                          <div className="h-24 flex items-center justify-center text-xs text-zinc-600">
                            Drop cases here
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      </div>
    </div>
  );
}

export default function CasesPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-400" /></div>}>
      <CasesContent />
    </Suspense>
  );
}
