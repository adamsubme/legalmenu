'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { STATUS_LABELS, SUB_STATUS_LABELS, WORKFLOW_STAGES, timeAgo, formatDate } from '@/lib/utils';
import {
  ArrowLeft, Send, Clock, User, FileText, AlertTriangle, CheckCircle2,
  XCircle, Paperclip, MessageSquare, History, Upload, Link2, StickyNote,
  ChevronDown, ChevronUp, ExternalLink, Plus, Pencil, Check, X,
} from 'lucide-react';
import Link from 'next/link';
import type { Task, TaskActivity, TaskAttachment, TaskDeliverable } from '@/lib/types';

type Tab = 'chat' | 'timeline' | 'documents' | 'deliverables';
type TaskExt = Task & { sub_status?: string };

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [task, setTask] = useState<TaskExt | null>(null);
  const [activities, setActivities] = useState<TaskActivity[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [deliverables, setDeliverables] = useState<TaskDeliverable[]>([]);
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([]);
  const [tab, setTab] = useState<Tab>('chat');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [descExpanded, setDescExpanded] = useState(false);
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docUrl, setDocUrl] = useState('');
  const [docNote, setDocNote] = useState('');

  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const [tRes, actRes, attRes, delRes] = await Promise.all([
          fetch(`/api/tasks/${id}`), fetch(`/api/tasks/${id}/activities`),
          fetch(`/api/tasks/${id}/attachments`), fetch(`/api/tasks/${id}/deliverables`),
        ]);
        if (tRes.ok) setTask(await tRes.json());
        if (actRes.ok) setActivities(await actRes.json());
        if (attRes.ok) { const d = await attRes.json(); setAttachments(Array.isArray(d) ? d : []); }
        if (delRes.ok) { const d = await delRes.json(); setDeliverables(Array.isArray(d) ? d : []); }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
    const i = setInterval(load, 10000);
    return () => clearInterval(i);
  }, [id]);

  useEffect(() => {
    if (!task?.planning_session_key) return;
    async function loadChat() {
      try {
        const res = await fetch(`/api/openclaw/chat?sessionKey=${task!.planning_session_key}`);
        if (res.ok) { const d = await res.json(); setChatMessages(Array.isArray(d) ? d : d.messages || []); }
      } catch {}
    }
    loadChat();
    const i = setInterval(loadChat, 8000);
    return () => clearInterval(i);
  }, [task?.planning_session_key]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  useEffect(() => { if (editingTitle && titleInputRef.current) titleInputRef.current.focus(); }, [editingTitle]);

  const handleSend = async () => {
    if (!message.trim() || !task) return;
    setSending(true);
    try {
      await fetch('/api/openclaw/chat/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionKey: task.planning_session_key, content: message, agentId: task.assigned_agent_id }) });
      setMessage('');
    } catch (e) { console.error(e); }
    finally { setSending(false); }
  };

  const updateTask = async (updates: Record<string, unknown>) => {
    if (!task) return;
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
      if (res.ok) setTask(await res.json());
    } catch (e) { console.error(e); }
  };

  const saveTitle = async () => {
    if (!editTitle.trim() || editTitle === task?.title) { setEditingTitle(false); return; }
    await updateTask({ title: editTitle });
    setEditingTitle(false);
  };

  const saveDesc = async () => {
    await updateTask({ description: editDesc });
    setEditingDesc(false);
  };

  const addAttachment = async (type: 'link' | 'note') => {
    const title = docTitle || (type === 'link' ? docUrl : 'Note');
    if (!title) return;
    try {
      await fetch(`/api/tasks/${id}/attachments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attachment_type: type, title, url: type === 'link' ? docUrl : undefined, content: type === 'note' ? docNote : undefined }),
      });
      setDocTitle(''); setDocUrl(''); setDocNote(''); setShowAddDoc(false);
      const res = await fetch(`/api/tasks/${id}/attachments`);
      if (res.ok) setAttachments(await res.json());
    } catch (e) { console.error(e); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('task_id', id);
    try {
      await fetch('/api/attachments/upload', { method: 'POST', body: formData });
      const res = await fetch(`/api/tasks/${id}/attachments`);
      if (res.ok) setAttachments(await res.json());
    } catch (e) { console.error(e); }
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-400" /></div>;
  if (!task) return <div className="flex h-screen items-center justify-center"><p className="text-zinc-500">Case not found</p></div>;

  const stageMap: Record<string, number> = { not_started: 0, in_progress: 1, blocked: 2, awaiting_approval: 3, done: 5 };
  const currentStage = stageMap[task.status] ?? 0;

  const tabs: { id: Tab; label: string; icon: React.ElementType; count?: number }[] = [
    { id: 'chat', label: 'Chat', icon: MessageSquare, count: chatMessages.length },
    { id: 'timeline', label: 'Timeline', icon: History, count: activities.length },
    { id: 'documents', label: 'Documents', icon: FileText, count: attachments.length },
    { id: 'deliverables', label: 'Deliverables', icon: CheckCircle2, count: deliverables.length },
  ];

  return (
    <div className="flex flex-col h-screen">
      {/* Top Bar */}
      <div className="flex items-center gap-3 border-b border-zinc-800 px-6 py-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/cases')}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <div className="flex items-center gap-2">
              <input
                ref={titleInputRef}
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
                className="text-lg font-semibold bg-zinc-900 border border-zinc-600 rounded-md px-2 py-0.5 text-zinc-100 flex-1 focus:border-blue-500 focus:outline-none"
              />
              <button onClick={saveTitle} className="text-emerald-400 hover:text-emerald-300"><Check className="h-4 w-4" /></button>
              <button onClick={() => setEditingTitle(false)} className="text-zinc-500 hover:text-zinc-300"><X className="h-4 w-4" /></button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <h1 className="text-lg font-semibold truncate">{task.title}</h1>
              <button
                onClick={() => { setEditTitle(task.title); setEditingTitle(true); }}
                className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-zinc-300 transition-all"
              ><Pencil className="h-3.5 w-3.5" /></button>
            </div>
          )}
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant={task.status === 'in_progress' ? 'info' : task.status === 'blocked' ? 'destructive' : task.status === 'awaiting_approval' ? 'warning' : task.status === 'done' ? 'success' : 'secondary'}>{STATUS_LABELS[task.status]}</Badge>
            {task.sub_status && <Badge variant="warning">{SUB_STATUS_LABELS[task.sub_status] || task.sub_status}</Badge>}
            {task.priority !== 'normal' && <Badge variant={task.priority === 'urgent' ? 'destructive' : 'warning'}>{task.priority}</Badge>}
            {task.assigned_agent && <span className="text-xs text-zinc-500">{(task as { assigned_agent_emoji?: string }).assigned_agent_emoji || ''} {(task as { assigned_agent_name?: string }).assigned_agent_name || task.assigned_agent.name}</span>}
            <span className="text-xs text-zinc-600">Created {formatDate(task.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Workflow Timeline */}
      <div className="border-b border-zinc-800 px-6 py-3">
        <div className="flex items-center gap-1">
          {WORKFLOW_STAGES.map((stage, i) => (
            <div key={stage.id} className="flex items-center flex-1">
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                i < currentStage ? 'bg-emerald-500/15 text-emerald-400' :
                i === currentStage ? (task.status === 'blocked' ? 'bg-red-500/15 text-red-400 ring-1 ring-red-500/30' : 'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30') :
                'bg-zinc-800/50 text-zinc-600'
              }`}>
                {i < currentStage ? <CheckCircle2 className="h-3 w-3" /> : i === currentStage && task.status === 'blocked' ? <XCircle className="h-3 w-3" /> : null}
                {stage.label}
              </div>
              {i < WORKFLOW_STAGES.length - 1 && <div className={`flex-1 h-px mx-1 ${i < currentStage ? 'bg-emerald-500/30' : 'bg-zinc-800'}`} />}
            </div>
          ))}
        </div>
      </div>

      {/* Description */}
      <div className="border-b border-zinc-800 px-6 py-3">
        <div className="flex items-center justify-between">
          <button onClick={() => setDescExpanded(!descExpanded)} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
            {descExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            <span className="font-medium">Description</span>
            {!task.description && <span className="text-zinc-600 text-xs">(empty)</span>}
          </button>
          {descExpanded && !editingDesc && (
            <button
              onClick={() => { setEditDesc(task.description || ''); setEditingDesc(true); }}
              className="text-zinc-600 hover:text-zinc-300 transition-colors"
            ><Pencil className="h-3.5 w-3.5" /></button>
          )}
        </div>
        {descExpanded && (
          editingDesc ? (
            <div className="mt-2 space-y-2">
              <textarea
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                className="w-full min-h-[120px] rounded-md border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none resize-y"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setEditingDesc(false)}>Cancel</Button>
                <Button size="sm" onClick={saveDesc}><Check className="h-3 w-3 mr-1" />Save</Button>
              </div>
            </div>
          ) : (
            <div className="mt-2 text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap pl-5">
              {task.description || <span className="text-zinc-600 italic">No description yet. Click the edit icon to add one.</span>}
            </div>
          )
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center border-b border-zinc-800 px-6">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 px-3 py-2.5 text-sm border-b-2 transition-colors ${tab === t.id ? 'border-blue-400 text-zinc-100' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>
                <t.icon className="h-3.5 w-3.5" />{t.label}
                {(t.count ?? 0) > 0 && <span className="text-[10px] bg-zinc-800 rounded-full px-1.5">{t.count}</span>}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {tab === 'chat' && (
              <div className="flex flex-col h-full">
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {chatMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                      <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
                      <p className="text-sm">No messages in this session</p>
                      <p className="text-xs mt-1">Send a message to start a conversation with the agent</p>
                    </div>
                  ) : chatMessages.map((msg, i) => (
                    <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                      {msg.role !== 'user' && <div className="h-7 w-7 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 text-xs">{msg.role === 'assistant' ? '⚖️' : '🔧'}</div>}
                      <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-200'}`}>
                        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{msg.content}</pre>
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <div className="border-t border-zinc-800 p-3">
                  <div className="flex gap-2">
                    <Input value={message} onChange={e => setMessage(e.target.value)} placeholder="Message the agent..." className="flex-1" onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()} disabled={sending} />
                    <Button onClick={handleSend} disabled={sending || !message.trim()}><Send className="h-4 w-4" /></Button>
                  </div>
                </div>
              </div>
            )}

            {tab === 'timeline' && (
              <div className="p-6">
                {activities.length === 0 ? <p className="text-sm text-zinc-500 text-center py-8">No activity yet</p> : (
                  <div className="relative pl-6 space-y-4">
                    <div className="absolute left-[11px] top-2 bottom-2 w-px bg-zinc-800" />
                    {activities.map(a => (
                      <div key={a.id} className="relative flex gap-3">
                        <div className={`absolute left-[-17px] top-1.5 h-3 w-3 rounded-full border-2 ${
                          a.activity_type === 'completed' ? 'border-emerald-500 bg-emerald-500/20' :
                          a.activity_type === 'status_changed' ? 'border-blue-500 bg-blue-500/20' :
                          'border-zinc-700 bg-zinc-900'
                        }`} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {a.agent && <span className="text-xs font-medium text-zinc-300">{a.agent.avatar_emoji} {a.agent.name}</span>}
                            <Badge variant="outline" className="text-[10px]">{a.activity_type}</Badge>
                            <span className="text-[10px] text-zinc-600 ml-auto">{formatDate(a.created_at)}</span>
                          </div>
                          <p className="text-sm text-zinc-400 mt-1">{a.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'documents' && (
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setShowAddDoc(!showAddDoc)}><Plus className="h-3.5 w-3.5" />Add</Button>
                  <label className="cursor-pointer">
                    <input type="file" className="hidden" onChange={handleFileUpload} />
                    <span className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 h-8 px-3 text-xs font-medium cursor-pointer transition-colors"><Upload className="h-3.5 w-3.5" />Upload File</span>
                  </label>
                </div>

                {showAddDoc && (
                  <Card className="animate-slide-in">
                    <CardContent className="p-4 space-y-3">
                      <Input value={docTitle} onChange={e => setDocTitle(e.target.value)} placeholder="Title" className="h-8 text-xs" />
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Input value={docUrl} onChange={e => setDocUrl(e.target.value)} placeholder="URL (for links)" className="h-8 text-xs" />
                        </div>
                        <Button size="sm" onClick={() => addAttachment('link')} disabled={!docUrl}><Link2 className="h-3.5 w-3.5" />Add Link</Button>
                      </div>
                      <div className="flex gap-2">
                        <textarea value={docNote} onChange={e => setDocNote(e.target.value)} placeholder="Note content..." className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 min-h-[60px]" />
                        <Button size="sm" onClick={() => addAttachment('note')} disabled={!docNote}><StickyNote className="h-3.5 w-3.5" />Add Note</Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {attachments.length === 0 && !showAddDoc ? (
                  <div className="text-center py-8"><FileText className="h-8 w-8 mx-auto text-zinc-600 mb-2" /><p className="text-sm text-zinc-500">No documents yet</p></div>
                ) : attachments.map(att => (
                  <div key={att.id} className="flex items-center gap-3 p-3 rounded-lg border border-zinc-800 hover:bg-zinc-800/50 transition-colors">
                    {att.attachment_type === 'link' ? <Link2 className="h-4 w-4 text-blue-400 shrink-0" /> : att.attachment_type === 'note' ? <StickyNote className="h-4 w-4 text-amber-400 shrink-0" /> : <Paperclip className="h-4 w-4 text-zinc-500 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{att.title || att.file_name}</p>
                      <p className="text-xs text-zinc-500">{att.attachment_type}{att.file_size ? ` · ${(att.file_size / 1024).toFixed(0)}KB` : ''} · {timeAgo(att.created_at)}</p>
                      {att.content && <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{att.content}</p>}
                    </div>
                    {att.url && <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300"><ExternalLink className="h-3.5 w-3.5" /></a>}
                    <Badge variant="outline">{att.attachment_type}</Badge>
                  </div>
                ))}
              </div>
            )}

            {tab === 'deliverables' && (
              <div className="p-6 space-y-3">
                {deliverables.length === 0 ? (
                  <div className="text-center py-8"><CheckCircle2 className="h-8 w-8 mx-auto text-zinc-600 mb-2" /><p className="text-sm text-zinc-500">No deliverables yet</p></div>
                ) : deliverables.map(del => (
                  <div key={del.id} className="flex items-center gap-3 p-3 rounded-lg border border-zinc-800">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{del.title}</p>
                      {del.description && <p className="text-xs text-zinc-500 mt-0.5">{del.description}</p>}
                      {del.path && <p className="text-xs font-mono text-zinc-600 mt-0.5">{del.path}</p>}
                    </div>
                    {del.path && del.path.includes('docs.google.com') && (
                      <a href={del.path} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300"><ExternalLink className="h-4 w-4" /></a>
                    )}
                    <Badge variant="outline">{del.deliverable_type}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-72 border-l border-zinc-800 overflow-y-auto p-4 space-y-5">
          <div>
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Status</h3>
            <select value={task.status} onChange={e => updateTask({ status: e.target.value })} className="w-full h-8 rounded-md border border-zinc-700 bg-zinc-900 px-2 text-sm text-zinc-300">
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          {task.status === 'blocked' && (
            <div>
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Block Reason</h3>
              <select value={task.sub_status || ''} onChange={e => updateTask({ sub_status: e.target.value || null })} className="w-full h-8 rounded-md border border-zinc-700 bg-zinc-900 px-2 text-sm text-zinc-300">
                <option value="">Not specified</option>
                {Object.entries(SUB_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          )}

          <div>
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Priority</h3>
            <select value={task.priority} onChange={e => updateTask({ priority: e.target.value })} className="w-full h-8 rounded-md border border-zinc-700 bg-zinc-900 px-2 text-sm text-zinc-300">
              <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
            </select>
          </div>

          <div>
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-zinc-500">Agent</span><span className="text-zinc-300">{(task as { assigned_agent_name?: string }).assigned_agent_name || '—'}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Created</span><span className="text-zinc-300">{formatDate(task.created_at)}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Updated</span><span className="text-zinc-300">{formatDate(task.updated_at)}</span></div>
              {task.due_date && <div className="flex justify-between"><span className="text-zinc-500">Due</span><span className="text-zinc-300">{formatDate(task.due_date)}</span></div>}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Actions</h3>
            <div className="space-y-1.5">
              <Button variant="ghost" size="sm" className="w-full justify-start text-xs" onClick={() => updateTask({ status: 'in_progress' })}><User className="h-3 w-3 mr-2" />Start Work</Button>
              <Button variant="ghost" size="sm" className="w-full justify-start text-xs" onClick={() => updateTask({ status: 'awaiting_approval' })}><Clock className="h-3 w-3 mr-2" />Send for Review</Button>
              <Button variant="ghost" size="sm" className="w-full justify-start text-xs" onClick={() => updateTask({ status: 'done' })}><CheckCircle2 className="h-3 w-3 mr-2" />Mark Done</Button>
              <Button variant="ghost" size="sm" className="w-full justify-start text-xs text-amber-400" onClick={() => { updateTask({ status: 'blocked', sub_status: 'waiting_client' }); }}><AlertTriangle className="h-3 w-3 mr-2" />Block: Waiting Client</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
