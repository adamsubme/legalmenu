'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { STATUS_LABELS, SUB_STATUS_LABELS, timeAgo, formatDate } from '@/lib/utils';
import {
  ArrowLeft, Send, Clock, User, FileText, AlertTriangle, CheckCircle2,
  Upload, Link2, StickyNote, Plus, Trash2, ExternalLink, X,
  Bot, BookOpen, Folder, Users, Briefcase, FileCheck, MessageSquare,
  ChevronDown, Search, Globe, Scale,
} from 'lucide-react';
import Link from 'next/link';
import type { Task, TaskActivity, TaskAttachment, KnowledgeEntry } from '@/lib/types';

type Tab = 'chat' | 'knowledge' | 'legal' | 'project' | 'client' | 'files' | 'timeline';

type TaskExt = Task & {
  sub_status?: string;
  client_name?: string;
  project_name?: string;
  assigned_agent_name?: string;
  assigned_agent_avatar?: string;
};

type FileAttachment = TaskAttachment & { url?: string };

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  
  // Data state
  const [task, setTask] = useState<TaskExt | null>(null);
  const [activities, setActivities] = useState<TaskActivity[]>([]);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>([]);
  const [clientKnowledge, setClientKnowledge] = useState<KnowledgeEntry[]>([]);
  const [projectKnowledge, setProjectKnowledge] = useState<KnowledgeEntry[]>([]);
  const [globalKnowledge, setGlobalKnowledge] = useState<KnowledgeEntry[]>([]);
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string; timestamp?: number }[]>([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  
  // UI state
  const [tab, setTab] = useState<Tab>('chat');
  const [loading, setLoading] = useState(true);
  
  // Form states
  const [showAddFile, setShowAddFile] = useState(false);
  const [showAddLink, setShowAddLink] = useState(false);
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [showAddKnowledge, setShowAddKnowledge] = useState(false);
  const [kbTitle, setKbTitle] = useState('');
  const [kbContent, setKbContent] = useState('');
  const [kbType, setKbType] = useState<'document' | 'memo' | 'precedent'>('document');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    try {
      const [tRes, actRes, attRes, kbRes] = await Promise.all([
        fetch(`/api/tasks/${id}`, { credentials: 'include' }),
        fetch(`/api/tasks/${id}/activities`, { credentials: 'include' }),
        fetch(`/api/tasks/${id}/attachments`, { credentials: 'include' }),
        fetch(`/api/knowledge?scope=task&scope_id=${id}`, { credentials: 'include' }),
      ]);
      
      if (tRes.ok) {
        const taskData = await tRes.json();
        setTask(taskData);
        
        // Load client and project knowledge
        if (taskData.client_id) {
          const [clientKbRes, clientProjKbRes] = await Promise.all([
            fetch(`/api/knowledge?scope=client&scope_id=${taskData.client_id}`, { credentials: 'include' }),
            taskData.project_id 
              ? fetch(`/api/knowledge?scope=project&scope_id=${taskData.project_id}`, { credentials: 'include' })
              : Promise.resolve(new Response('', { status: 404 })),
          ]);
          if (clientKbRes.ok) setClientKnowledge(await clientKbRes.json());
          if (clientProjKbRes.ok) setProjectKnowledge(await clientProjKbRes.json());
        }
        
        // Load global knowledge
        const globalKbRes = await fetch('/api/knowledge?scope=global', { credentials: 'include' });
        if (globalKbRes.ok) setGlobalKnowledge(await globalKbRes.json());
      }
      
      if (actRes.ok) setActivities(await actRes.json());
      if (attRes.ok) { const d = await attRes.json(); setAttachments(Array.isArray(d) ? d : []); }
      if (kbRes.ok) { const d = await kbRes.json(); setKnowledge(Array.isArray(d) ? d : []); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!task?.planning_session_key) return;
    
    async function loadChat() {
      try {
        const res = await fetch(`/api/openclaw/chat?sessionKey=${task!.planning_session_key}`, { credentials: 'include' });
        if (res.ok) { const d = await res.json(); setChatMessages(Array.isArray(d) ? d : d.messages || []); }
      } catch {}
    }
    loadChat();
    const i = setInterval(loadChat, 5000);
    return () => clearInterval(i);
  }, [task?.planning_session_key]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  const handleSend = async () => {
    if (!message.trim() || !task?.planning_session_key) return;
    setSending(true);
    try {
      await fetch('/api/openclaw/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionKey: task.planning_session_key, content: message, agentId: task.assigned_agent_id }),
        credentials: 'include',
      });
      setMessage('');
    } catch (e) { console.error(e); }
    finally { setSending(false); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const fd = new FormData();
    fd.append('file', file);
    fd.append('taskId', id);
    
    try {
      const uploadRes = await fetch('/api/attachments/upload', { method: 'POST', body: fd, credentials: 'include' });
      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        await fetch(`/api/tasks/${id}/attachments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attachment_type: 'file',
            title: file.name,
            file_path: uploadData.file_path,
            file_name: uploadData.file_name,
            file_size: uploadData.file_size,
            file_mime: uploadData.file_mime,
          }),
          credentials: 'include',
        });
        loadData();
      }
    } catch (e) { console.error(e); }
  };

  const handleAddLink = async () => {
    if (!newLinkUrl) return;
    try {
      await fetch(`/api/tasks/${id}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attachment_type: 'link',
          title: newLinkTitle || newLinkUrl,
          url: newLinkUrl,
        }),
        credentials: 'include',
      });
      setNewLinkTitle('');
      setNewLinkUrl('');
      setShowAddLink(false);
      loadData();
    } catch (e) { console.error(e); }
  };

  const handleAddKnowledge = async () => {
    if (!kbTitle || !kbContent) return;
    try {
      await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: kbTitle,
          content: kbContent,
          scope: 'task',
          scope_id: id,
          entry_type: kbType,
        }),
        credentials: 'include',
      });
      setKbTitle('');
      setKbContent('');
      setShowAddKnowledge(false);
      loadData();
    } catch (e) { console.error(e); }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    try {
      await fetch(`/api/tasks/${id}/attachments/${attachmentId}`, { method: 'DELETE', credentials: 'include' });
      loadData();
    } catch (e) { console.error(e); }
  };

  const priorityColors: Record<string, string> = {
    urgent: 'bg-red-500/10 text-red-400 border-red-500/30',
    high: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    normal: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    low: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30',
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-400" /></div>;
  }

  if (!task) {
    return <div className="p-6 text-zinc-500">Case not found</div>;
  }

  const fileAttachments = attachments.filter(a => a.attachment_type === 'file');
  const links = attachments.filter(a => a.attachment_type === 'link');

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-950/50">
        <div className="flex items-center gap-4 mb-3">
          <Link href="/cases">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{task.title}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-zinc-400">
              {task.client_name && (
                <Link href={`/clients/${task.client_id}`} className="flex items-center gap-1 hover:text-blue-400">
                  <Users className="h-3 w-3" /> {task.client_name}
                </Link>
              )}
              {task.project_name && (
                <Link href={`/projects/${task.project_id}`} className="flex items-center gap-1 hover:text-blue-400">
                  <Briefcase className="h-3 w-3" /> {task.project_name}
                </Link>
              )}
              {task.assigned_agent && (
                <span className="flex items-center gap-1">
                  <Bot className="h-3 w-3" /> {task.assigned_agent.avatar_emoji} {task.assigned_agent.name}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {task.priority && (
              <Badge className={priorityColors[task.priority] || ''}>{task.priority}</Badge>
            )}
            <Badge variant={task.status === 'done' ? 'success' : 'secondary'}>
              {STATUS_LABELS[task.status] || task.status}
            </Badge>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="grid grid-cols-7 w-full">
            <TabsTrigger value="chat" className="gap-1"><MessageSquare className="h-3 w-3" /> Chat</TabsTrigger>
            <TabsTrigger value="knowledge" className="gap-1"><BookOpen className="h-3 w-3" /> Case KB</TabsTrigger>
            <TabsTrigger value="legal" className="gap-1"><Scale className="h-3 w-3" /> Legal</TabsTrigger>
            <TabsTrigger value="project" className="gap-1"><Folder className="h-3 w-3" /> Project</TabsTrigger>
            <TabsTrigger value="client" className="gap-1"><Users className="h-3 w-3" /> Client</TabsTrigger>
            <TabsTrigger value="files" className="gap-1"><FileText className="h-3 w-3" /> Files ({fileAttachments.length})</TabsTrigger>
            <TabsTrigger value="timeline" className="gap-1"><Clock className="h-3 w-3" /> Timeline</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-4">
        
        {/* Chat Tab */}
        <TabsContent value="chat" className="h-full mt-0">
          <Card className="h-full flex flex-col">
            <CardContent className="flex-1 overflow-auto p-4 space-y-3">
              {chatMessages.length === 0 ? (
                <div className="text-center text-zinc-500 py-8">
                  <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No messages yet. Agents will discuss this case here.</p>
                </div>
              ) : (
                chatMessages.map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                      msg.role === 'user' ? 'bg-blue-500/20' : msg.role === 'agent' ? 'bg-purple-500/20' : 'bg-zinc-500/20'
                    }`}>
                      {msg.role === 'user' ? <User className="h-4 w-4" /> : msg.role === 'agent' ? <Bot className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                    </div>
                    <div className={`flex-1 max-w-2xl ${msg.role === 'user' ? 'text-right' : ''}`}>
                      <div className={`inline-block rounded-lg p-3 ${
                        msg.role === 'user' ? 'bg-blue-500/20' : msg.role === 'agent' ? 'bg-purple-500/20' : 'bg-zinc-500/20'
                      }`}>
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        {msg.timestamp && <p className="text-xs text-zinc-500 mt-1">{timeAgo(new Date(msg.timestamp).toISOString())}</p>}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </CardContent>
            
            {/* Message Input */}
            <div className="p-4 border-t border-zinc-800">
              <div className="flex gap-2">
                <Input
                  placeholder="Send a message to agents..."
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  className="flex-1"
                />
                <Button onClick={handleSend} disabled={sending || !message.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Case Knowledge Tab */}
        <TabsContent value="knowledge" className="mt-0">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Case Knowledge Base</h3>
              <Button size="sm" variant="outline" onClick={() => setShowAddKnowledge(true)}>
                <Plus className="h-4 w-4 mr-2" />Add Entry
              </Button>
            </div>
            
            {showAddKnowledge && (
              <Card className="border-blue-500/30 bg-blue-500/5">
                <CardContent className="p-4 space-y-3">
                  <div className="flex gap-2">
                    <Input placeholder="Entry title" value={kbTitle} onChange={e => setKbTitle(e.target.value)} className="flex-1" />
                    <select value={kbType} onChange={e => setKbType(e.target.value as typeof kbType)} className="bg-zinc-900 border border-zinc-700 rounded px-2">
                      <option value="document">Document</option>
                      <option value="memo">Memo</option>
                      <option value="precedent">Precedent</option>
                    </select>
                  </div>
                  <textarea
                    className="w-full h-24 bg-zinc-900 border border-zinc-700 rounded p-2 text-sm"
                    placeholder="Content..."
                    value={kbContent}
                    onChange={e => setKbContent(e.target.value)}
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setShowAddKnowledge(false)}>Cancel</Button>
                    <Button size="sm" onClick={handleAddKnowledge}>Save</Button>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {knowledge.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-zinc-500">
                <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No case knowledge entries yet.</p>
                <p className="text-sm mt-1">Knowledge will be generated as agents analyze the case.</p>
              </CardContent></Card>
            ) : (
              <div className="grid gap-3">
                {knowledge.map(k => (
                  <Card key={k.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{k.title}</p>
                          <Badge variant="outline" className="mt-1 text-xs">{k.entry_type}</Badge>
                          <p className="text-sm text-zinc-400 mt-2 line-clamp-3">{k.content}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Legal Knowledge Tab */}
        <TabsContent value="legal" className="mt-0">
          <div className="space-y-4">
            <h3 className="font-semibold">Relevant Legal Knowledge</h3>
            <p className="text-sm text-zinc-400">Global legal framework, regulations, and precedents applicable to this case.</p>
            
            {globalKnowledge.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-zinc-500">
                <Scale className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No global legal knowledge configured.</p>
              </CardContent></Card>
            ) : (
              <div className="grid gap-3">
                {globalKnowledge.map(k => (
                  <Card key={k.id}>
                    <CardContent className="p-4">
                      <p className="font-medium">{k.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{k.entry_type}</Badge>
                        {k.tags && k.tags.split(',').map(t => <Badge key={t} variant="secondary" className="text-xs">{t.trim()}</Badge>)}
                      </div>
                      <p className="text-sm text-zinc-400 mt-2 line-clamp-4">{k.content}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Project Knowledge Tab */}
        <TabsContent value="project" className="mt-0">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Project Knowledge</h3>
              {task.project_id && <Link href={`/projects/${task.project_id}`}><Button size="sm" variant="ghost">View Project →</Button></Link>}
            </div>
            
            {projectKnowledge.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-zinc-500">
                <Folder className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No project-specific knowledge entries.</p>
              </CardContent></Card>
            ) : (
              <div className="grid gap-3">
                {projectKnowledge.map(k => (
                  <Card key={k.id}>
                    <CardContent className="p-4">
                      <p className="font-medium">{k.title}</p>
                      <Badge variant="outline" className="mt-1 text-xs">{k.entry_type}</Badge>
                      <p className="text-sm text-zinc-400 mt-2 line-clamp-3">{k.content}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Client Knowledge Tab */}
        <TabsContent value="client" className="mt-0">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Client Knowledge</h3>
              {task.client_id && <Link href={`/clients/${task.client_id}`}><Button size="sm" variant="ghost">View Client →</Button></Link>}
            </div>
            
            {clientKnowledge.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-zinc-500">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No client-specific knowledge entries.</p>
              </CardContent></Card>
            ) : (
              <div className="grid gap-3">
                {clientKnowledge.map(k => (
                  <Card key={k.id}>
                    <CardContent className="p-4">
                      <p className="font-medium">{k.title}</p>
                      <Badge variant="outline" className="mt-1 text-xs">{k.entry_type}</Badge>
                      <p className="text-sm text-zinc-400 mt-2 line-clamp-3">{k.content}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Files Tab */}
        <TabsContent value="files" className="mt-0">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowAddFile(true)}>
                <Upload className="h-4 w-4 mr-2" />Upload File
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAddLink(true)}>
                <Link2 className="h-4 w-4 mr-2" />Add Link
              </Button>
            </div>
            
            {showAddFile && (
              <Card className="border-blue-500/30 bg-blue-500/5">
                <CardContent className="p-4">
                  <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                    Choose File
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowAddFile(false)} className="ml-2">Cancel</Button>
                </CardContent>
              </Card>
            )}
            
            {showAddLink && (
              <Card className="border-blue-500/30 bg-blue-500/5">
                <CardContent className="p-4 space-y-3">
                  <Input placeholder="Link title (optional)" value={newLinkTitle} onChange={e => setNewLinkTitle(e.target.value)} />
                  <Input type="url" placeholder="https://..." value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)} />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setShowAddLink(false)}>Cancel</Button>
                    <Button size="sm" onClick={handleAddLink}>Save Link</Button>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {links.length > 0 && (
              <div>
                <h4 className="font-medium text-sm text-zinc-400 mb-2">Links</h4>
                <div className="grid gap-2">
                  {links.map(l => (
                    <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-lg border border-zinc-800 hover:bg-zinc-800/50 group">
                      <Link2 className="h-5 w-5 text-blue-400" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate group-hover:text-blue-400">{l.title}</p>
                        <p className="text-xs text-zinc-500 truncate">{l.url}</p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-zinc-600" />
                    </a>
                  ))}
                </div>
              </div>
            )}
            
            {fileAttachments.length > 0 && (
              <div>
                <h4 className="font-medium text-sm text-zinc-400 mb-2">Files</h4>
                <div className="grid gap-2">
                  {fileAttachments.map(f => (
                    <div key={f.id} className="flex items-center gap-3 p-3 rounded-lg border border-zinc-800 hover:bg-zinc-800/50 group">
                      <FileText className="h-5 w-5 text-zinc-400" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{f.title}</p>
                        <p className="text-xs text-zinc-500">{f.file_name} • {f.file_size ? (f.file_size / 1024).toFixed(1) : 0}KB</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteAttachment(f.id)}>
                        <Trash2 className="h-4 w-4 text-zinc-500 hover:text-red-400" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {fileAttachments.length === 0 && links.length === 0 && (
              <Card><CardContent className="p-8 text-center text-zinc-500">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No files or links attached yet.</p>
              </CardContent></Card>
            )}
          </div>
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="mt-0">
          <div className="space-y-4">
            {activities.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-zinc-500">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No activity recorded yet.</p>
              </CardContent></Card>
            ) : (
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-px bg-zinc-800" />
                <div className="space-y-4">
                  {activities.map(a => (
                    <div key={a.id} className="flex gap-4 relative">
                      <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 z-10">
                        {a.activity_type === 'status_change' ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> :
                         a.activity_type === 'comment' ? <MessageSquare className="h-4 w-4 text-blue-400" /> :
                         a.activity_type === 'assignment' ? <User className="h-4 w-4 text-purple-400" /> :
                         <Clock className="h-4 w-4 text-zinc-400" />}
                      </div>
                      <div className="flex-1 pb-4">
                        <p className="text-sm">{a.message}</p>
                        <p className="text-xs text-zinc-500 mt-1">{timeAgo(a.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </div>
    </div>
  );
}
