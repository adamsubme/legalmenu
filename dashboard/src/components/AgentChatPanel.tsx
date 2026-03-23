'use client';

import { useState, useEffect, useRef } from 'react';
import { MessageSquare, ChevronRight, RefreshCw, User, Send, Loader2 } from 'lucide-react';

interface Session {
  key: string;
  displayName?: string;
  kind?: string;
  origin?: { label?: string; provider?: string };
  sessionId?: string;
}

const AGENT_META: Record<string, { emoji: string; label: string }> = {
  'lex-coo': { emoji: '⚖️', label: 'COO' },
  'lex-intake': { emoji: '📋', label: 'Intake' },
  'lex-research': { emoji: '🔍', label: 'Research' },
  'lex-draft': { emoji: '✍️', label: 'Draft' },
  'lex-control': { emoji: '🛡️', label: 'Control' },
  'lex-memory': { emoji: '🧠', label: 'Memory' },
};

export function AgentChatPanel() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ role: string; content: string | unknown }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msgInput, setMsgInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadSessions(); }, []);

  useEffect(() => {
    if (selectedKey) loadChat(selectedKey);
    else setMessages([]);
  }, [selectedKey]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Auto-poll when a session is selected
  useEffect(() => {
    if (!selectedKey) return;
    const poll = setInterval(() => loadChat(selectedKey), 6000);
    return () => clearInterval(poll);
  }, [selectedKey]);

  const loadSessions = async () => {
    try {
      const res = await fetch('/api/openclaw/status');
      if (res.ok) {
        const data = await res.json();
        const sess = data.sessions?.sessions ?? data.sessions ?? [];
        setSessions(Array.isArray(sess) ? sess : []);
      }
    } catch { setSessions([]); }
  };

  const loadChat = async (sessionKey: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/openclaw/chat?sessionKey=${encodeURIComponent(sessionKey)}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages ?? []);
      } else {
        const err = await res.json();
        setError(err.error || 'Failed to load chat');
        setMessages([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setMessages([]);
    } finally { setLoading(false); }
  };

  const handleSend = async () => {
    if (!msgInput.trim() || !selectedKey) return;
    setSending(true);
    try {
      await fetch('/api/openclaw/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionKey: selectedKey, message: msgInput }),
      });
      setMsgInput('');
      setTimeout(() => loadChat(selectedKey), 2000);
    } catch (e) { console.error(e); }
    finally { setSending(false); }
  };

  const getAgentInfo = (key: string) => {
    const agentId = key.split(':')[1] || '';
    return AGENT_META[agentId] || { emoji: '🤖', label: agentId };
  };

  const getSessionLabel = (s: Session) => {
    const agent = getAgentInfo(s.key);
    const origin = s.origin?.label ?? s.displayName ?? '';
    return `${agent.emoji} ${agent.label}${origin ? ' — ' + origin : ''}`;
  };

  return (
    <aside className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
      <div className="p-3 border-b border-mc-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-mc-accent" />
            <span className="text-sm font-medium uppercase tracking-wider">Agent Chat</span>
          </div>
          <button onClick={loadSessions} className="p-1 rounded hover:bg-mc-bg-tertiary text-mc-text-secondary" title="Odśwież">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Session list */}
        <div className="w-24 border-r border-mc-border flex flex-col overflow-hidden">
          <div className="p-2 text-xs text-mc-text-secondary uppercase">Agenci</div>
          <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
            {sessions.length === 0 ? (
              <div className="text-xs text-mc-text-secondary p-2">Brak sesji</div>
            ) : (
              sessions.map((s) => {
                const info = getAgentInfo(s.key);
                return (
                  <button
                    key={s.key}
                    onClick={() => setSelectedKey(s.key === selectedKey ? null : s.key)}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs truncate flex items-center gap-1 ${
                      selectedKey === s.key ? 'bg-mc-accent/20 text-mc-accent' : 'hover:bg-mc-bg-tertiary text-mc-text'
                    }`}
                    title={s.key}
                  >
                    <span>{info.emoji}</span>
                    <span className="truncate">{info.label}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Messages + input */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {selectedKey ? (
            <>
              <div className="p-2 border-b border-mc-border text-xs text-mc-text-secondary truncate">
                {getSessionLabel(sessions.find((s) => s.key === selectedKey) ?? { key: selectedKey })}
              </div>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 space-y-2">
                {loading && messages.length === 0 ? (
                  <div className="text-center py-4 text-mc-text-secondary text-sm"><Loader2 className="w-4 h-4 animate-spin inline mr-1" />Ładowanie...</div>
                ) : error ? (
                  <div className="text-center py-4 text-mc-accent-red text-sm">{error}</div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-4 text-mc-text-secondary text-sm">Brak wiadomości</div>
                ) : (
                  messages.map((m, i) => {
                    const text = typeof m.content === 'string'
                      ? m.content
                      : Array.isArray(m.content)
                        ? (m.content as { type?: string; text?: string; thinking?: string; name?: string }[])
                            .map((p) =>
                              p.type === 'text' && p.text ? p.text
                              : p.thinking ? `💭 ${String(p.thinking).slice(0, 200)}...`
                              : p.type === 'toolCall' && p.name ? `🔧 [${p.name}]`
                              : ''
                            ).filter(Boolean).join(' ') || JSON.stringify(m.content).slice(0, 200)
                        : JSON.stringify(m.content).slice(0, 300);
                    if (!text) return null;
                    const isUser = m.role === 'user';
                    const info = selectedKey ? getAgentInfo(selectedKey) : { emoji: '🤖', label: 'Agent' };
                    return (
                      <div key={i} className={`flex gap-1.5 ${isUser ? 'flex-row-reverse' : ''}`}>
                        <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs ${isUser ? 'bg-mc-accent/20' : 'bg-mc-bg-tertiary'}`}>
                          {isUser ? <User className="w-3 h-3" /> : info.emoji}
                        </div>
                        <div className={`flex-1 min-w-0 rounded-lg px-2 py-1.5 text-xs ${isUser ? 'bg-mc-accent/10 text-mc-text' : 'bg-mc-bg-tertiary text-mc-text-secondary'}`}>
                          <div className="whitespace-pre-wrap break-words">{text}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              {/* Input */}
              <div className="p-2 border-t border-mc-border">
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={msgInput}
                    onChange={(e) => setMsgInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSend(); } }}
                    placeholder="Wiadomość..."
                    className="flex-1 bg-mc-bg border border-mc-border rounded px-2 py-1 text-xs focus:outline-none focus:border-mc-accent"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!msgInput.trim() || sending}
                    className="px-2 py-1 bg-mc-accent text-mc-bg rounded text-xs disabled:opacity-40"
                  >
                    {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-mc-text-secondary text-xs p-4 text-center">
              Wybierz agenta, aby zobaczyć konwersację
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
