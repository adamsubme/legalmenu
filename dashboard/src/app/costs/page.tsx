'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AGENT_MAP } from '@/lib/utils';
import { DollarSign, BarChart3, RefreshCw, TrendingUp, Bot, Cpu, Info } from 'lucide-react';

interface CostData {
  period: string;
  total_cost: number;
  by_agent: Record<string, { tokens_in: number; tokens_out: number; requests: number }>;
  by_model: Array<{ model: string; tokens_in: number; tokens_out: number; requests: number; cost: number }>;
  log_files_parsed: number;
  note?: string;
}

export default function CostsPage() {
  const [data, setData] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const res = await fetch('/api/costs');
      if (res.ok) setData(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-400" /></div>;

  const totalTokens = data ? Object.values(data.by_agent).reduce((s, a) => s + a.tokens_in + a.tokens_out, 0) : 0;
  const totalReqs = data ? Object.values(data.by_agent).reduce((s, a) => s + a.requests, 0) : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Costs</h1>
          <p className="text-sm text-zinc-400 mt-1">Usage data from gateway logs ({data?.period || 'last 7 days'})</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setLoading(true); load(); }}><RefreshCw className="h-3.5 w-3.5 mr-1" />Refresh</Button>
      </div>

      {data?.note && (
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <Info className="h-5 w-5 text-blue-400 shrink-0" />
            <p className="text-sm text-zinc-300">{data.note}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-5"><div className="flex items-center justify-between"><div><p className="text-sm text-zinc-400">Total Cost</p><p className="text-3xl font-bold mt-1">${data?.total_cost?.toFixed(2) || '0.00'}</p></div><DollarSign className="h-8 w-8 text-emerald-400 opacity-80" /></div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="flex items-center justify-between"><div><p className="text-sm text-zinc-400">Total Tokens</p><p className="text-3xl font-bold mt-1">{(totalTokens / 1000).toFixed(1)}K</p></div><TrendingUp className="h-8 w-8 text-blue-400 opacity-80" /></div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="flex items-center justify-between"><div><p className="text-sm text-zinc-400">Requests</p><p className="text-3xl font-bold mt-1">{totalReqs}</p></div><BarChart3 className="h-8 w-8 text-purple-400 opacity-80" /></div></CardContent></Card>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Bot className="h-4 w-4 text-blue-400" />By Agent</CardTitle></CardHeader>
          <CardContent>
            {Object.keys(data?.by_agent || {}).length === 0 ? (
              <p className="text-sm text-zinc-500">No agent usage data yet</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(data!.by_agent).map(([agent, stats]) => {
                  const info = AGENT_MAP[agent];
                  const pct = totalTokens > 0 ? ((stats.tokens_in + stats.tokens_out) / totalTokens * 100) : 0;
                  return (
                    <div key={agent}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{info?.emoji || '🤖'} {info?.name || agent}</span>
                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                          <span>{stats.requests} req</span>
                          <span>{((stats.tokens_in + stats.tokens_out) / 1000).toFixed(1)}K tokens</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${Math.max(pct, 2)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Cpu className="h-4 w-4 text-purple-400" />By Model</CardTitle></CardHeader>
          <CardContent>
            {!data?.by_model?.length ? (
              <p className="text-sm text-zinc-500">No model usage data yet</p>
            ) : (
              <div className="space-y-3">
                {data.by_model.map(m => (
                  <div key={m.model} className="flex items-center gap-3 p-2 rounded-md border border-zinc-800 bg-zinc-900/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium font-mono truncate">{m.model}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-500">
                        <span>In: {(m.tokens_in / 1000).toFixed(1)}K</span>
                        <span>Out: {(m.tokens_out / 1000).toFixed(1)}K</span>
                        <span>{m.requests} req</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="font-mono">${m.cost.toFixed(2)}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
