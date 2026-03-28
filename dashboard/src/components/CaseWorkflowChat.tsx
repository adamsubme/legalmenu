/**
 * CaseWorkflowChat — live agent communication viewer for a task
 * Shows pipeline: Intake → Research → Draft → Control → Memory
 * Displays all agent sessions related to the case with live polling
 */
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare, Send, RefreshCw, Loader2, User, Bot,
  ArrowRight, ChevronDown, ChevronUp, Maximize2, Minimize2,
} from 'lucide-react';
import { useMissionControl } from '@/lib/store';
import { ui } from '@/lib/messages';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | ContentPart[];
}

interface ContentPart {
  type?: string;
  text?: string;
  thinking?: string;
  name?: string;
}

interface AgentSession {
  key: string;
  agentId: string;
  agentName: string;
  emoji: string;
  messages: ChatMessage[];
  loading: boolean;
  error?: string;
}

const PIPELINE = [
  { id: 'lex-coo', name: 'COO', emoji: '⚖️', color: 'text-amber-400' },
  { id: 'lex-intake', name: 'Intake', emoji: '📋', color: 'text-blue-400' },
  { id: 'lex-research', name: 'Research', emoji: '🔍', color: 'text-purple-400' },
  { id: 'lex-draft', name: 'Draft', emoji: '✍️', color: 'text-green-400' },
  { id: 'lex-control', name: 'Control', emoji: '🛡️', color: 'text-red-400' },
  { id: 'lex-memory', name: 'Memory', emoji: '🧠', color: 'text-cyan-400' },
];

function extractText(content: string | ContentPart[]): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return JSON.stringify(content).slice(0, 500);
  return content
    .map((p) => {
      if (p.type === 'text' && p.text) return p.text;
      if (p.thinking) return `💭 ${String(p.thinking).slice(0, 300)}...`;
      if (p.type === 'toolCall' && p.name) return `🔧 [${p.name}]`;
      return '';
    })
    .filter(Boolean)
    .join('\n') || JSON.stringify(content).slice(0, 300);
}

interface CaseWorkflowChatProps {
  taskId: string;
}

export function CaseWorkflowChat({ taskId }: CaseWorkflowChatProps) {
  const { agents } = useMissionControl();
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [activeAgent, setActiveAgent] = useState<string>('lex-coo');
  const [loading, setLoading] = useState(true);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const loadAllSessions = useCallback(async () => {
    try {
      const statusRes = await fetch('/api/openclaw/status');
      if (!statusRes.ok) return;
      const status = await statusRes.json();
      const liveSessions = status.sessions?.sessions ?? [];

      const newSessions: AgentSession[] = [];

      for (const stage of PIPELINE) {
        const matchingSessions = liveSessions.filter(
          (s: { key: string }) => s.key.startsWith(`agent:${stage.id}:`)
        );

        let messages: ChatMessage[] = [];
        let error: string | undefined;

        if (matchingSessions.length > 0) {
          const sessionKey = matchingSessions[0].key;
          try {
            const chatRes = await fetch(
              `/api/openclaw/chat?sessionKey=${encodeURIComponent(sessionKey)}&limit=100`
            );
            if (chatRes.ok) {
              const data = await chatRes.json();
              messages = data.messages ?? [];
            } else {
              const errData = await chatRes.json();
              error = errData.error;
            }
          } catch (e) {
            error = e instanceof Error ? e.message : 'Load failed';
          }
        }

        newSessions.push({
          key: matchingSessions[0]?.key || `agent:${stage.id}:main`,
          agentId: stage.id,
          agentName: stage.name,
          emoji: stage.emoji,
          messages,
          loading: false,
          error,
        });
      }

      setSessions(newSessions);
    } catch (e) {
      console.error('Failed to load sessions', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllSessions();
    pollRef.current = setInterval(loadAllSessions, 8000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadAllSessions]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [sessions, activeAgent]);

  const handleSend = async (agentId: string) => {
    if (!messageInput.trim()) return;
    setSendingTo(agentId);
    try {
      const sessionKey = `agent:${agentId}:main`;
      const res = await fetch('/api/openclaw/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionKey, message: messageInput }),
      });
      if (!res.ok) {
        // Fallback: use chat.send via dispatch-style endpoint
        const sendRes = await fetch('/api/openclaw/chat/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionKey, message: messageInput }),
        });
        if (!sendRes.ok) {
          console.error('Send failed');
        }
      }
      setMessageInput('');
      setTimeout(loadAllSessions, 2000);
    } catch (e) {
      console.error('Send error', e);
    } finally {
      setSendingTo(null);
    }
  };

  const activeSession = sessions.find((s) => s.agentId === activeAgent);

  const sessionsWithMessages = sessions.filter((s) => s.messages.length > 0);
  const activeStages = new Set(sessionsWithMessages.map((s) => s.agentId));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-mc-text-secondary">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> {ui.processing.loadingAgents}
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${expanded ? 'fixed inset-0 z-50 bg-mc-bg' : 'h-full'}`}>
      {/* Pipeline progress bar */}
      <div className="flex items-center gap-1 px-3 py-2 bg-mc-bg-tertiary rounded-t-lg border-b border-mc-border overflow-x-auto flex-shrink-0">
        {PIPELINE.map((stage, i) => {
          const isActive = activeStages.has(stage.id);
          const isCurrent = activeAgent === stage.id;
          return (
            <div key={stage.id} className="flex items-center">
              <button
                onClick={() => setActiveAgent(stage.id)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all whitespace-nowrap ${
                  isCurrent
                    ? 'bg-mc-accent text-mc-bg'
                    : isActive
                    ? 'bg-mc-accent/20 text-mc-accent hover:bg-mc-accent/30'
                    : 'text-mc-text-secondary hover:bg-mc-bg-secondary'
                }`}
              >
                <span>{stage.emoji}</span>
                <span>{stage.name}</span>
                {isActive && (
                  <span className="ml-1 w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                )}
              </button>
              {i < PIPELINE.length - 1 && (
                <ArrowRight className="w-3 h-3 text-mc-text-secondary mx-0.5 flex-shrink-0" />
              )}
            </div>
          );
        })}
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={loadAllSessions}
            className="p-1 rounded hover:bg-mc-bg-secondary text-mc-text-secondary"
            title={ui.tooltips.refresh}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded hover:bg-mc-bg-secondary text-mc-text-secondary"
            title={expanded ? ui.tooltips.minimize : ui.tooltips.fullScreen}
          >
            {expanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {activeSession?.error && (
          <div className="text-sm text-mc-accent-red bg-mc-accent-red/10 rounded px-3 py-2">
            {activeSession.error}
          </div>
        )}

        {!activeSession || activeSession.messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-mc-text-secondary">
            <MessageSquare className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">{ui.agents.noMessagesFor(PIPELINE.find(p => p.id === activeAgent)?.name ?? '')}</p>
            <p className="text-xs mt-1 opacity-70">
              {ui.agents.sentToAgent}
            </p>
          </div>
        ) : (
          activeSession.messages.map((msg, i) => {
            const text = extractText(msg.content);
            if (!text) return null;
            const isUser = msg.role === 'user';
            const isSystem = msg.role === 'system';
            const stage = PIPELINE.find((p) => p.id === activeAgent);

            return (
              <div
                key={i}
                className={`flex gap-2 ${isUser ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs ${
                    isUser
                      ? 'bg-mc-accent/20'
                      : isSystem
                      ? 'bg-mc-bg-tertiary'
                      : 'bg-mc-bg-tertiary'
                  }`}
                >
                  {isUser ? <User className="w-3.5 h-3.5" /> : isSystem ? '⚙️' : stage?.emoji || '🤖'}
                </div>
                <div
                  className={`flex-1 min-w-0 rounded-lg px-3 py-2 text-sm ${
                    isUser
                      ? 'bg-mc-accent/10 text-mc-text'
                      : isSystem
                      ? 'bg-yellow-500/10 text-yellow-300 border border-yellow-500/20'
                      : 'bg-mc-bg-tertiary text-mc-text'
                  }`}
                >
                  {!isUser && !isSystem && (
                    <div className={`text-xs font-medium mb-1 ${stage?.color || 'text-mc-accent'}`}>
                      {stage?.emoji} {stage?.name}
                    </div>
                  )}
                  <div className="whitespace-pre-wrap break-words leading-relaxed">{text}</div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Message input */}
      <div className="flex-shrink-0 border-t border-mc-border p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(activeAgent);
              }
            }}
            placeholder={`Wyślij do ${PIPELINE.find(p => p.id === activeAgent)?.name}...`}
            className="flex-1 bg-mc-bg border border-mc-border rounded px-3 py-2 text-sm focus:outline-none focus:border-mc-accent"
          />
          <button
            onClick={() => handleSend(activeAgent)}
            disabled={!messageInput.trim() || sendingTo !== null}
            className="flex items-center gap-1.5 px-4 py-2 bg-mc-accent text-mc-bg rounded text-sm font-medium disabled:opacity-40"
          >
            {sendingTo ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
