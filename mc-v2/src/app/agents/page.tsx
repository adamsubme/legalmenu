'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AGENT_MAP, timeAgo } from '@/lib/utils';
import { Cpu, Activity, Zap, Clock, MessageSquare } from 'lucide-react';
import type { Agent, OpenClawSessionInfo } from '@/lib/types';

interface AgentWithSessions extends Agent {
  sessions?: OpenClawSessionInfo[];
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentWithSessions[]>([]);
  const [sessions, setSessions] = useState<OpenClawSessionInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [agentsRes, sessionsRes] = await Promise.all([
          fetch('/api/agents'),
          fetch('/api/openclaw/sessions'),
        ]);
        const agentsData = agentsRes.ok ? await agentsRes.json() : [];
        const sessionsData = sessionsRes.ok ? await sessionsRes.json() : [];
        setAgents(agentsData);
        setSessions(Array.isArray(sessionsData) ? sessionsData : []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-400" />
      </div>
    );
  }

  const agentIds = Object.keys(AGENT_MAP);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Agenci</h1>
        <p className="text-sm text-zinc-400 mt-1">Status zespołu AI, modele i aktywne sesje</p>
      </div>

      {/* Overview Bar */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={<Activity className="h-5 w-5 text-blue-400" />}
          label="Aktywni"
          value={agents.filter((a) => a.status === 'working').length}
        />
        <StatCard
          icon={<Clock className="h-5 w-5 text-emerald-400" />}
          label="Standby"
          value={agents.filter((a) => a.status === 'standby').length}
        />
        <StatCard
          icon={<Zap className="h-5 w-5 text-amber-400" />}
          label="Sesje"
          value={sessions.length}
        />
        <StatCard
          icon={<Cpu className="h-5 w-5 text-purple-400" />}
          label="Modele"
          value={4}
          suffix="aktywne"
        />
      </div>

      {/* Agent Grid */}
      <div className="grid grid-cols-2 gap-4">
        {agents.map((agent) => {
          const agentKey = agent.name.toLowerCase().replace(/ /g, '-');
          const info = AGENT_MAP[agentKey] || { role: agent.role, model: '—', emoji: agent.avatar_emoji, name: agent.name };
          const agentSessions = sessions.filter(
            (s) => s.id?.includes(agentKey) || s.channel?.includes(agentKey)
          );
          const isWorking = agent.status === 'working';

          return (
            <Card key={agent.id} className={isWorking ? 'border-blue-500/30' : ''}>
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-3xl">{info.emoji}</span>
                    <div className="flex items-center gap-1.5">
                      <div
                        className={`h-2 w-2 rounded-full ${
                          isWorking
                            ? 'bg-blue-400 animate-pulse'
                            : agent.status === 'standby'
                            ? 'bg-emerald-400'
                            : 'bg-zinc-600'
                        }`}
                      />
                      <span className="text-[10px] text-zinc-500 capitalize">{agent.status}</span>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{agent.name}</h3>
                      <Badge variant="outline" className="text-[10px]">{info.role}</Badge>
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">{agent.description || `Agent: ${info.role}`}</p>

                    <div className="mt-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Cpu className="h-3 w-3 text-zinc-500" />
                        <span className="text-xs text-zinc-400">Model:</span>
                        <span className="text-xs font-mono text-zinc-300">{info.model}</span>
                      </div>

                      {agentSessions.length > 0 && (
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-3 w-3 text-zinc-500" />
                          <span className="text-xs text-zinc-400">Sesje:</span>
                          <span className="text-xs text-zinc-300">{agentSessions.length} aktywnych</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3 text-zinc-500" />
                        <span className="text-xs text-zinc-400">Ostatnia aktywność:</span>
                        <span className="text-xs text-zinc-300">{timeAgo(agent.updated_at)}</span>
                      </div>
                    </div>

                    {/* Model tier badge */}
                    <div className="mt-3 flex gap-1.5">
                      {agentKey === 'lex-coo' && <TierBadge tier="balanced" />}
                      {agentKey === 'lex-intake' && <TierBadge tier="workhorse" />}
                      {agentKey === 'lex-research' && <TierBadge tier="workhorse" />}
                      {agentKey === 'lex-draft' && <TierBadge tier="workhorse" />}
                      {agentKey === 'lex-control' && <TierBadge tier="budget" />}
                      {agentKey === 'lex-memory' && <TierBadge tier="budget" />}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Model Routing Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Routing modeli (4-tier)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <TierCard
              name="Frontier"
              model="Gemini 3.1 Pro"
              usage="~15%"
              color="text-purple-400"
              desc="Deep research, złożone pisma, conflict resolution"
            />
            <TierCard
              name="Workhorse"
              model="GLM-5"
              usage="~40%"
              color="text-blue-400"
              desc="Research standard, contract scan, intake, drafting"
            />
            <TierCard
              name="Balanced"
              model="Gemini 3.0"
              usage="~15%"
              color="text-teal-400"
              desc="Fallback, quick research, client updates, COO default"
            />
            <TierCard
              name="Budget"
              model="MiniMax M2.5"
              usage="~30%"
              color="text-zinc-400"
              desc="Klasyfikacja, routing, tagging, health checks, checklists"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value, suffix }: { icon: React.ReactNode; label: string; value: number; suffix?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        {icon}
        <div>
          <p className="text-2xl font-bold">
            {value}
            {suffix && <span className="text-xs text-zinc-500 ml-1 font-normal">{suffix}</span>}
          </p>
          <p className="text-xs text-zinc-500">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function TierBadge({ tier }: { tier: 'frontier' | 'workhorse' | 'balanced' | 'budget' }) {
  const styles = {
    frontier: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    workhorse: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    balanced: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
    budget: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${styles[tier]}`}>
      {tier}
    </span>
  );
}

function TierCard({ name, model, usage, color, desc }: { name: string; model: string; usage: string; color: string; desc: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className={`text-sm font-semibold ${color}`}>{name}</span>
        <span className="text-xs text-zinc-600">{usage}</span>
      </div>
      <p className="text-xs font-mono text-zinc-300">{model}</p>
      <p className="text-[11px] text-zinc-500 leading-relaxed">{desc}</p>
    </div>
  );
}
