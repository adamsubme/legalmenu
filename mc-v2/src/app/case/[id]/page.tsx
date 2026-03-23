'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { timeAgo, formatDate, AGENT_MAP } from '@/lib/utils';
import {
  ArrowLeft, Send, Clock, User, FileText, AlertTriangle,
  CheckCircle2, XCircle, Paperclip, MessageSquare, History,
} from 'lucide-react';
import Link from 'next/link';
import type { Task, TaskActivity, TaskAttachment, TaskDeliverable } from '@/lib/types';

type Tab = 'chat' | 'timeline' | 'documents' | 'deliverables';

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [task, setTask] = useState<Task | null>(null);
  const [activities, setActivities] = useState<TaskActivity[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [deliverables, setDeliverables] = useState<TaskDeliverable[]>([]);
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([]);
  const [tab, setTab] = useState<Tab>('chat');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const [taskRes, activitiesRes, attachmentsRes, deliverablesRes] = await Promise.all([
          fetch(`/api/tasks/${id}`),
          fetch(`/api/tasks/${id}/activities`),
          fetch(`/api/tasks/${id}/attachments`),
          fetch(`/api/tasks/${id}/deliverables`),
        ]);
        if (taskRes.ok) setTask(await taskRes.json());
        if (activitiesRes.ok) setActivities(await activitiesRes.json());
        if (attachmentsRes.ok) {
          const data = await attachmentsRes.json();
          setAttachments(Array.isArray(data) ? data : []);
        }
        if (deliverablesRes.ok) {
          const data = await deliverablesRes.json();
          setDeliverables(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    if (!task?.planning_session_key) return;
    async function loadChat() {
      try {
        const res = await fetch(`/api/openclaw/chat?sessionKey=${task!.planning_session_key}`);
        if (res.ok) {
          const data = await res.json();
          setChatMessages(Array.isArray(data) ? data : data.messages || []);
        }
      } catch (e) {
        console.error(e);
      }
    }
    loadChat();
    const interval = setInterval(loadChat, 8000);
    return () => clearInterval(interval);
  }, [task?.planning_session_key]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSendMessage = async () => {
    if (!message.trim() || !task) return;
    setSending(true);
    try {
      await fetch('/api/openclaw/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionKey: task.planning_session_key,
          content: message,
          agentId: task.assigned_agent_id,
        }),
      });
      setMessage('');
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    if (!task) return;
    try {
      await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      setTask({ ...task, status: status as Task['status'] });
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-400" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-zinc-500">Sprawa nie znaleziona</p>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    not_started: 'secondary',
    in_progress: 'info',
    blocked: 'destructive',
    awaiting_approval: 'warning',
    done: 'success',
  };

  const statusLabels: Record<string, string> = {
    not_started: 'Nowa',
    in_progress: 'W toku',
    blocked: 'Zablokowana',
    awaiting_approval: 'Do akceptacji',
    done: 'Zamknięta',
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType; count?: number }[] = [
    { id: 'chat', label: 'Chat', icon: MessageSquare, count: chatMessages.length },
    { id: 'timeline', label: 'Timeline', icon: History, count: activities.length },
    { id: 'documents', label: 'Dokumenty', icon: FileText, count: attachments.length },
    { id: 'deliverables', label: 'Rezultaty', icon: CheckCircle2, count: deliverables.length },
  ];

  return (
    <div className="flex flex-col h-screen">
      {/* Top Bar */}
      <div className="flex items-center gap-3 border-b border-zinc-800 px-6 py-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/cases')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold truncate">{task.title}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant={statusColors[task.status] as 'info'}>
              {statusLabels[task.status] || task.status}
            </Badge>
            {task.priority !== 'normal' && (
              <Badge variant={task.priority === 'urgent' ? 'destructive' : task.priority === 'high' ? 'warning' : 'secondary'}>
                {task.priority}
              </Badge>
            )}
            {task.assigned_agent && (
              <span className="text-xs text-zinc-500">
                {task.assigned_agent.avatar_emoji} {task.assigned_agent.name}
              </span>
            )}
            <span className="text-xs text-zinc-600">
              Utworzono {formatDate(task.created_at)}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {task.status !== 'done' && (
            <>
              <Button size="sm" variant="outline" onClick={() => handleStatusChange('in_progress')}>
                W toku
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleStatusChange('awaiting_approval')}>
                Do review
              </Button>
              <Button size="sm" onClick={() => handleStatusChange('done')}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Zamknij
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main Panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex items-center border-b border-zinc-800 px-6">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm border-b-2 transition-colors ${
                  tab === t.id
                    ? 'border-blue-400 text-zinc-100'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
                {t.count !== undefined && t.count > 0 && (
                  <span className="text-[10px] bg-zinc-800 rounded-full px-1.5">{t.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto">
            {tab === 'chat' && (
              <div className="flex flex-col h-full">
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {chatMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                      <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
                      <p className="text-sm">Brak wiadomości w tej sesji</p>
                      <p className="text-xs mt-1">Wyślij wiadomość aby rozpocząć rozmowę z agentem</p>
                    </div>
                  ) : (
                    chatMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}
                      >
                        {msg.role !== 'user' && (
                          <div className="h-7 w-7 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 text-xs">
                            {msg.role === 'assistant' ? '⚖️' : '🔧'}
                          </div>
                        )}
                        <div
                          className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                            msg.role === 'user'
                              ? 'bg-blue-600 text-white'
                              : 'bg-zinc-800 text-zinc-200'
                          }`}
                        >
                          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                            {msg.content}
                          </pre>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={chatEndRef} />
                </div>
                <div className="border-t border-zinc-800 p-3">
                  <div className="flex gap-2">
                    <Input
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Napisz do agenta..."
                      className="flex-1"
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                      disabled={sending}
                    />
                    <Button onClick={handleSendMessage} disabled={sending || !message.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {tab === 'timeline' && (
              <div className="p-6">
                {activities.length === 0 ? (
                  <p className="text-sm text-zinc-500 text-center py-8">Brak aktywności</p>
                ) : (
                  <div className="relative pl-6 space-y-4">
                    <div className="absolute left-[11px] top-2 bottom-2 w-px bg-zinc-800" />
                    {activities.map((activity) => (
                      <div key={activity.id} className="relative flex gap-3">
                        <div className="absolute left-[-17px] top-1.5 h-3 w-3 rounded-full border-2 border-zinc-800 bg-zinc-900" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {activity.agent && (
                              <span className="text-xs font-medium text-zinc-300">
                                {activity.agent.avatar_emoji} {activity.agent.name}
                              </span>
                            )}
                            <Badge variant="outline" className="text-[10px]">
                              {activity.activity_type}
                            </Badge>
                            <span className="text-[10px] text-zinc-600 ml-auto">
                              {formatDate(activity.created_at)}
                            </span>
                          </div>
                          <p className="text-sm text-zinc-400 mt-1">{activity.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'documents' && (
              <div className="p-6 space-y-3">
                {attachments.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-8 w-8 mx-auto text-zinc-600 mb-2" />
                    <p className="text-sm text-zinc-500">Brak dokumentów</p>
                  </div>
                ) : (
                  attachments.map((att) => (
                    <div key={att.id} className="flex items-center gap-3 p-3 rounded-lg border border-zinc-800 hover:bg-zinc-800/50">
                      <Paperclip className="h-4 w-4 text-zinc-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{att.title || att.file_name}</p>
                        <p className="text-xs text-zinc-500">
                          {att.attachment_type} · {att.file_size ? `${(att.file_size / 1024).toFixed(0)}KB` : ''} · {timeAgo(att.created_at)}
                        </p>
                      </div>
                      <Badge variant="outline">{att.attachment_type}</Badge>
                    </div>
                  ))
                )}
              </div>
            )}

            {tab === 'deliverables' && (
              <div className="p-6 space-y-3">
                {deliverables.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="h-8 w-8 mx-auto text-zinc-600 mb-2" />
                    <p className="text-sm text-zinc-500">Brak rezultatów</p>
                  </div>
                ) : (
                  deliverables.map((del) => (
                    <div key={del.id} className="flex items-center gap-3 p-3 rounded-lg border border-zinc-800">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{del.title}</p>
                        {del.description && <p className="text-xs text-zinc-500">{del.description}</p>}
                      </div>
                      <Badge variant="outline">{del.deliverable_type}</Badge>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-72 border-l border-zinc-800 overflow-y-auto p-4 space-y-4">
          <div>
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Szczegóły</h3>
            <div className="space-y-3">
              <DetailRow label="Status" value={statusLabels[task.status]} />
              <DetailRow label="Priorytet" value={task.priority} />
              <DetailRow label="Agent" value={task.assigned_agent?.name || '—'} />
              <DetailRow label="Utworzono" value={formatDate(task.created_at)} />
              <DetailRow label="Aktualizacja" value={formatDate(task.updated_at)} />
              {task.due_date && <DetailRow label="Termin" value={formatDate(task.due_date)} />}
            </div>
          </div>

          {task.description && (
            <div>
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Opis</h3>
              <p className="text-sm text-zinc-300 leading-relaxed">{task.description}</p>
            </div>
          )}

          <div>
            <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Szybkie akcje</h3>
            <div className="space-y-1.5">
              <Button variant="ghost" size="sm" className="w-full justify-start text-xs">
                <User className="h-3 w-3 mr-2" />
                Przypisz agenta
              </Button>
              <Button variant="ghost" size="sm" className="w-full justify-start text-xs">
                <AlertTriangle className="h-3 w-3 mr-2" />
                Eskaluj
              </Button>
              <Button variant="ghost" size="sm" className="w-full justify-start text-xs text-red-400">
                <XCircle className="h-3 w-3 mr-2" />
                Zablokuj
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-300">{value}</span>
    </div>
  );
}
