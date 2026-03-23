'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AGENT_MAP } from '@/lib/utils';
import { Bot, Settings, BookOpen, Brain } from 'lucide-react';
import Link from 'next/link';
import type { Agent } from '@/lib/types';

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/agents');
        if (res.ok) setAgents(await res.json());
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
    const i = setInterval(load, 15000);
    return () => clearInterval(i);
  }, []);

  if (loading) return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-400" /></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agents</h1>
          <p className="text-sm text-zinc-400 mt-1">{agents.length} agents configured</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {agents.map(agent => {
          const agentKey = agent.name.toLowerCase().replace(/ /g, '-');
          const info = AGENT_MAP[agentKey] || { role: agent.name, primaryModel: '—', tier: '—', emoji: agent.avatar_emoji };
          return (
            <Link key={agent.id} href={`/agents/${agentKey}`}>
              <Card className="hover:border-zinc-600 transition-all hover:shadow-lg hover:shadow-black/20 cursor-pointer group">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="text-3xl">{agent.avatar_emoji}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-zinc-100 group-hover:text-blue-400 transition-colors">{agent.name}</h3>
                        <div className={`h-2 w-2 rounded-full ${agent.status === 'working' ? 'bg-blue-400 animate-pulse' : agent.status === 'standby' ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                      </div>
                      <p className="text-sm text-zinc-400 mt-0.5">{info.role}</p>

                      <div className="flex items-center gap-2 mt-3">
                        <Badge variant="outline" className="text-[10px] gap-1"><Bot className="h-2.5 w-2.5" />{info.primaryModel}</Badge>
                        <Badge variant="outline" className="text-[10px] gap-1"><Settings className="h-2.5 w-2.5" />{info.tier}</Badge>
                      </div>

                      <div className="flex items-center gap-3 mt-3 text-xs text-zinc-500">
                        <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />Files</span>
                        <span className="flex items-center gap-1"><Brain className="h-3 w-3" />Lessons</span>
                        <span className="ml-auto capitalize text-zinc-600">{agent.status}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
