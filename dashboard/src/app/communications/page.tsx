'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDate, timeAgo } from '@/lib/utils';
import { 
  MessageSquare, Mail, Send as SendIcon, Search, Inbox, User, Bot,
  Paperclip, ArrowRight, ChevronLeft, Phone, MessageCircle, ArrowDown
} from 'lucide-react';
import Link from 'next/link';
import type { ClientMessage } from '@/lib/types-v3';

interface ChatMessage {
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp?: number;
}

interface SessionConversation {
  session_id: string;
  channel: string;
  peer: string;
  agent_id?: string;
  agent_name?: string;
  status: string;
  last_message?: string;
  messages: ChatMessage[];
}

export default function CommunicationsPage() {
  const [messages, setMessages] = useState<ClientMessage[]>([]);
  const [sessions, setSessions] = useState<SessionConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'inbox' | 'chat'>('inbox');
  
  // Compose state
  const [showCompose, setShowCompose] = useState(false);
  const [newMsg, setNewMsg] = useState({
    task_id: '', channel: 'email' as 'email' | 'telegram',
    direction: 'outbound' as 'inbound' | 'outbound',
    sender: 'Lex Legal', recipient: '', subject: '', body: ''
  });

  // Chat state
  const [selectedSession, setSelectedSession] = useState<SessionConversation | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (channelFilter) params.set('channel', channelFilter);
      const res = await fetch(`/api/communications?${params}`, { credentials: 'include' });
      if (res.ok) setMessages(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [channelFilter]);

  const loadSessions = useCallback(async () => {
    try {
      // Load from OpenClaw sessions
      const sessionsRes = await fetch('/api/openclaw/sessions', { credentials: 'include' });
      if (sessionsRes.ok) {
        const data = await sessionsRes.json();
        const sessionList = data.sessions || data || [];
        
        // Enrich sessions with chat history
        const enrichedSessions: SessionConversation[] = [];
        for (const session of sessionList) {
          if (session.session_id && (session.channel === 'telegram' || session.channel === 'email')) {
            try {
              const historyRes = await fetch(`/api/openclaw/sessions/${session.session_id}/history`, { credentials: 'include' });
              const history = historyRes.ok ? await historyRes.json() : [];
              enrichedSessions.push({
                ...session,
                messages: Array.isArray(history) ? history : history.messages || []
              });
            } catch {
              enrichedSessions.push({ ...session, messages: [] });
            }
          }
        }
        setSessions(enrichedSessions);
      }
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    loadMessages();
    loadSessions();
    const i = setInterval(() => { loadMessages(); loadSessions(); }, 15000);
    return () => clearInterval(i);
  }, [loadMessages, loadSessions]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const sendMessage = async () => {
    if (!newMsg.body.trim()) return;
    try {
      await fetch('/api/communications', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMsg),
        credentials: 'include',
      });
      setShowCompose(false);
      setNewMsg({ task_id: '', channel: 'email', direction: 'outbound', sender: 'Lex Legal', recipient: '', subject: '', body: '' });
      loadMessages();
    } catch (e) { console.error(e); }
  };

  const sendChatReply = async () => {
    if (!replyText.trim() || !selectedSession) return;
    setSending(true);
    try {
      await fetch(`/api/openclaw/sessions/${selectedSession.session_id}/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: replyText }),
        credentials: 'include',
      });
      setReplyText('');
      // Reload sessions to get updated messages
      loadSessions();
    } catch (e) { console.error(e); }
    finally { setSending(false); }
  };

  const selectSession = (session: SessionConversation) => {
    setSelectedSession(session);
    setChatMessages(session.messages || []);
    setTab('chat');
  };

  const filteredMessages = messages.filter(m =>
    !search || m.body.toLowerCase().includes(search.toLowerCase()) ||
    m.subject?.toLowerCase().includes(search.toLowerCase()) ||
    m.sender?.toLowerCase().includes(search.toLowerCase())
  );

  const telegramSessions = sessions.filter(s => s.channel === 'telegram');
  const emailSessions = sessions.filter(s => s.channel === 'email');

  if (loading) return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-400" /></div>;

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-zinc-800 bg-zinc-950/50">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold">Communications</h1>
            <p className="text-sm text-zinc-400">Email, Telegram & Agent Chats</p>
          </div>
          <Button onClick={() => setShowCompose(!showCompose)}><SendIcon className="h-3.5 w-3.5 mr-1" />Compose</Button>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="inbox" className="gap-1"><Inbox className="h-3 w-3" />Inbox</TabsTrigger>
            <TabsTrigger value="chat" className="gap-1"><MessageCircle className="h-3 w-3" />Live Chat {selectedSession ? `(${selectedSession.peer})` : ''}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {tab === 'inbox' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search messages..." className="pl-8 h-8 text-xs" />
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant={channelFilter === '' ? 'default' : 'ghost'} onClick={() => setChannelFilter('')}>All</Button>
                <Button size="sm" variant={channelFilter === 'email' ? 'default' : 'ghost'} onClick={() => setChannelFilter('email')}><Mail className="h-3 w-3 mr-1" />Email</Button>
                <Button size="sm" variant={channelFilter === 'telegram' ? 'default' : 'ghost'} onClick={() => setChannelFilter('telegram')}><MessageSquare className="h-3 w-3 mr-1" />Telegram</Button>
              </div>
            </div>

            {/* Telegram Live Sessions */}
            {telegramSessions.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-zinc-400 mb-2 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />Live Telegram Chats
                </h3>
                <div className="grid gap-2">
                  {telegramSessions.map(session => (
                    <Card key={session.session_id} className="hover:border-blue-500/50 cursor-pointer transition-colors" onClick={() => selectSession(session)}>
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <User className="h-5 w-5 text-blue-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{session.peer || 'Unknown'}</p>
                            <p className="text-xs text-zinc-500 truncate">{session.agent_name || 'Agent'}</p>
                          </div>
                          <Badge variant={session.status === 'active' ? 'success' : 'secondary'} className="text-[10px]">{session.status}</Badge>
                          <ArrowRight className="h-4 w-4 text-zinc-500" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Compose */}
            {showCompose && (
              <Card className="border-blue-500/30 bg-blue-500/5">
                <CardHeader><CardTitle className="text-sm">Compose Message</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-3">
                    <select value={newMsg.channel} onChange={e => setNewMsg(p => ({ ...p, channel: e.target.value as 'email' | 'telegram' }))} className="h-8 rounded-md border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-300">
                      <option value="email">Email</option><option value="telegram">Telegram</option>
                    </select>
                    <Input value={newMsg.recipient} onChange={e => setNewMsg(p => ({ ...p, recipient: e.target.value }))} placeholder="Recipient" className="h-8 text-xs flex-1" />
                    {newMsg.channel === 'email' && <Input value={newMsg.subject} onChange={e => setNewMsg(p => ({ ...p, subject: e.target.value }))} placeholder="Subject" className="h-8 text-xs flex-1" />}
                  </div>
                  <textarea value={newMsg.body} onChange={e => setNewMsg(p => ({ ...p, body: e.target.value }))} placeholder="Message..." className="w-full min-h-[100px] rounded-md border border-zinc-700 bg-zinc-950 p-3 text-xs text-zinc-200 focus:border-blue-500 focus:outline-none" />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setShowCompose(false)}>Cancel</Button>
                    <Button size="sm" onClick={sendMessage} disabled={!newMsg.body.trim()}><SendIcon className="h-3 w-3 mr-1" />Send</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Message History */}
            {filteredMessages.length === 0 && telegramSessions.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Inbox className="h-10 w-10 mx-auto text-zinc-600 mb-3" />
                  <p className="text-lg font-medium text-zinc-300">No Communications</p>
                  <p className="text-sm text-zinc-500 mt-1">Messages will appear here when received</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-zinc-400 mb-2 flex items-center gap-2">
                  <Mail className="h-4 w-4" />Message History
                </h3>
                {filteredMessages.map(msg => (
                  <Card key={msg.id} className="hover:border-zinc-600 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${msg.direction === 'inbound' ? 'bg-blue-500/10' : 'bg-emerald-500/10'}`}>
                          {msg.channel === 'email' ? <Mail className={`h-4 w-4 ${msg.direction === 'inbound' ? 'text-blue-400' : 'text-emerald-400'}`} /> : <MessageSquare className={`h-4 w-4 ${msg.direction === 'inbound' ? 'text-blue-400' : 'text-emerald-400'}`} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{msg.sender || (msg.direction === 'inbound' ? 'Client' : 'Lex Legal')}</span>
                            <Badge variant={msg.direction === 'inbound' ? 'info' : 'success'} className="text-[10px]">{msg.direction}</Badge>
                            <Badge variant="outline" className="text-[10px]">{msg.channel}</Badge>
                            <span className="text-[10px] text-zinc-600 ml-auto">{formatDate(msg.created_at)}</span>
                          </div>
                          {msg.subject && <p className="text-sm text-zinc-300 mt-0.5 font-medium">{msg.subject}</p>}
                          <p className="text-xs text-zinc-400 mt-1 whitespace-pre-wrap">{msg.body}</p>
                          {msg.task_id && (
                            <Link href={`/case/${msg.task_id}`} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-1.5">
                              View case <ArrowRight className="h-3 w-3" />
                            </Link>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'chat' && (
          <div className="h-full flex flex-col">
            {selectedSession ? (
              <>
                {/* Chat Header */}
                <div className="flex items-center gap-3 mb-4 p-3 rounded-lg border border-zinc-800 bg-zinc-900/50">
                  <Button variant="ghost" size="icon" onClick={() => { setSelectedSession(null); setTab('inbox'); }}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <User className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{selectedSession.peer || 'Unknown'}</p>
                    <p className="text-xs text-zinc-500">{selectedSession.agent_name || 'Agent'} • {selectedSession.channel}</p>
                  </div>
                  <Badge variant={selectedSession.status === 'active' ? 'success' : 'secondary'}>{selectedSession.status}</Badge>
                </div>

                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                  {chatMessages.length === 0 ? (
                    <div className="text-center text-zinc-500 py-8">
                      <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No messages yet in this chat</p>
                    </div>
                  ) : (
                    chatMessages.map((msg, i) => (
                      <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-blue-500/20' : msg.role === 'agent' ? 'bg-purple-500/20' : 'bg-zinc-500/20'}`}>
                          {msg.role === 'user' ? <User className="h-4 w-4" /> : msg.role === 'agent' ? <Bot className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
                        </div>
                        <div className={`flex-1 max-w-2xl ${msg.role === 'user' ? 'text-right' : ''}`}>
                          <div className={`inline-block rounded-lg p-3 ${msg.role === 'user' ? 'bg-blue-500/20' : msg.role === 'agent' ? 'bg-purple-500/20' : 'bg-zinc-500/20'}`}>
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            {msg.timestamp && <p className="text-xs text-zinc-500 mt-1">{timeAgo(new Date(msg.timestamp).toISOString())}</p>}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Reply Input */}
                <div className="flex gap-2">
                  <Input
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder={`Reply to ${selectedSession.peer}...`}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChatReply()}
                    className="flex-1"
                  />
                  <Button onClick={sendChatReply} disabled={sending || !replyText.trim()}>
                    <SendIcon className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-zinc-500">
                <div className="text-center">
                  <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">Select a conversation</p>
                  <p className="text-sm mt-1">Choose a Telegram chat from the inbox to continue</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
