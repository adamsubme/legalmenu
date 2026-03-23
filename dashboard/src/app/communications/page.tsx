'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDate, timeAgo } from '@/lib/utils';
import { MessageSquare, Mail, Send as SendIcon, Search, Filter, ArrowRight, Inbox } from 'lucide-react';
import Link from 'next/link';
import type { ClientMessage } from '@/lib/types-v3';

export default function CommunicationsPage() {
  const [messages, setMessages] = useState<ClientMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [showCompose, setShowCompose] = useState(false);
  const [newMsg, setNewMsg] = useState<{ task_id: string; channel: 'email' | 'telegram'; direction: 'inbound' | 'outbound'; sender: string; recipient: string; subject: string; body: string }>({ task_id: '', channel: 'email', direction: 'outbound', sender: 'Lex Legal', recipient: '', subject: '', body: '' });

  useEffect(() => {
    async function load() {
      try {
        const params = new URLSearchParams();
        if (channelFilter) params.set('channel', channelFilter);
        const res = await fetch(`/api/communications?${params}`);
        if (res.ok) setMessages(await res.json());
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
    const i = setInterval(load, 15000);
    return () => clearInterval(i);
  }, [channelFilter]);

  const sendMessage = async () => {
    if (!newMsg.body.trim()) return;
    try {
      await fetch('/api/communications', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMsg),
      });
      setShowCompose(false);
      setNewMsg({ task_id: '', channel: 'email', direction: 'outbound', sender: 'Lex Legal', recipient: '', subject: '', body: '' });
      const res = await fetch('/api/communications');
      if (res.ok) setMessages(await res.json());
    } catch (e) { console.error(e); }
  };

  const filtered = messages.filter(m =>
    !search || m.body.toLowerCase().includes(search.toLowerCase()) ||
    m.subject?.toLowerCase().includes(search.toLowerCase()) ||
    m.sender?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-400" /></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Communications</h1>
          <p className="text-sm text-zinc-400 mt-1">Client messages — email &amp; telegram</p>
        </div>
        <Button onClick={() => setShowCompose(!showCompose)}><SendIcon className="h-3.5 w-3.5 mr-1" />Compose</Button>
      </div>

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

      {showCompose && (
        <Card className="animate-slide-in">
          <CardHeader><CardTitle className="text-sm">Compose Message</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-3">
              <select value={newMsg.channel} onChange={e => setNewMsg(p => ({ ...p, channel: e.target.value as 'email' | 'telegram' }))} className="h-8 rounded-md border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-300">
                <option value="email">Email</option><option value="telegram">Telegram</option>
              </select>
              <Input value={newMsg.recipient} onChange={e => setNewMsg(p => ({ ...p, recipient: e.target.value }))} placeholder="Recipient" className="h-8 text-xs" />
              {newMsg.channel === 'email' && <Input value={newMsg.subject} onChange={e => setNewMsg(p => ({ ...p, subject: e.target.value }))} placeholder="Subject" className="h-8 text-xs" />}
            </div>
            <textarea value={newMsg.body} onChange={e => setNewMsg(p => ({ ...p, body: e.target.value }))} placeholder="Message..." className="w-full min-h-[100px] rounded-md border border-zinc-700 bg-zinc-950 p-3 text-xs text-zinc-200 focus:border-blue-500 focus:outline-none" />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setShowCompose(false)}>Cancel</Button>
              <Button size="sm" onClick={sendMessage} disabled={!newMsg.body.trim()}><SendIcon className="h-3 w-3 mr-1" />Send</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Inbox className="h-10 w-10 mx-auto text-zinc-600 mb-3" />
            <p className="text-lg font-medium text-zinc-300">Inbox Empty</p>
            <p className="text-sm text-zinc-500 mt-1">No communications recorded yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(msg => (
            <Card key={msg.id} className="hover:border-zinc-600 transition-colors cursor-pointer group">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${msg.direction === 'inbound' ? 'bg-blue-500/10' : 'bg-emerald-500/10'}`}>
                    {msg.channel === 'email' ? <Mail className={`h-4 w-4 ${msg.direction === 'inbound' ? 'text-blue-400' : 'text-emerald-400'}`} /> : <MessageSquare className={`h-4 w-4 ${msg.direction === 'inbound' ? 'text-blue-400' : 'text-emerald-400'}`} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{msg.sender || (msg.direction === 'inbound' ? 'Client' : 'Lex Legal')}</span>
                      <Badge variant={msg.direction === 'inbound' ? 'info' : 'success'} className="text-[10px]">{msg.direction}</Badge>
                      <Badge variant="outline" className="text-[10px]">{msg.channel}</Badge>
                      <span className="text-[10px] text-zinc-600 ml-auto">{timeAgo(msg.created_at)}</span>
                    </div>
                    {msg.subject && <p className="text-sm text-zinc-300 mt-0.5 font-medium">{msg.subject}</p>}
                    <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{msg.body}</p>
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
  );
}
