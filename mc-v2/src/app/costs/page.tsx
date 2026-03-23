'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, Cpu, Zap } from 'lucide-react';

const TIERS = [
  {
    name: 'Gemini 3.1 Pro',
    tier: 'Frontier',
    usage: '~15%',
    costIn: '$2.00/1M',
    costOut: '$12.00/1M',
    estMonthly: '$34',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
  },
  {
    name: 'GLM-5',
    tier: 'Workhorse',
    usage: '~40%',
    costIn: 'varies',
    costOut: 'varies',
    estMonthly: 'varies',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
  },
  {
    name: 'Gemini 3.0',
    tier: 'Balanced',
    usage: '~15%',
    costIn: '$2.00/1M',
    costOut: '$12.00/1M',
    estMonthly: '$34',
    color: 'text-teal-400',
    bg: 'bg-teal-500/10',
    border: 'border-teal-500/20',
  },
  {
    name: 'MiniMax M2.5',
    tier: 'Budget',
    usage: '~30%',
    costIn: '$0.20/1M',
    costOut: '$1.20/1M',
    estMonthly: '$14',
    color: 'text-zinc-400',
    bg: 'bg-zinc-500/10',
    border: 'border-zinc-500/20',
  },
];

export default function CostsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Koszty</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Estymowane koszty modeli AI przy 300-500 sprawach/miesiąc
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <DollarSign className="h-5 w-5 text-emerald-400" />
            <div>
              <p className="text-2xl font-bold">~$80-150</p>
              <p className="text-xs text-zinc-500">Est. miesięczny (bez GLM-5)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Cpu className="h-5 w-5 text-blue-400" />
            <div>
              <p className="text-2xl font-bold">4</p>
              <p className="text-xs text-zinc-500">Aktywne modele</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-amber-400" />
            <div>
              <p className="text-2xl font-bold">~45M</p>
              <p className="text-xs text-zinc-500">Est. tokenów in/mies.</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Zap className="h-5 w-5 text-purple-400" />
            <div>
              <p className="text-2xl font-bold">~17M</p>
              <p className="text-xs text-zinc-500">Est. tokenów out/mies.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {TIERS.map((tier) => (
          <Card key={tier.name} className={tier.border}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold ${tier.color}`}>{tier.tier}</span>
                  <Badge variant="outline">{tier.usage}</Badge>
                </div>
                <span className="text-lg font-bold">{tier.estMonthly}</span>
              </div>
              <p className="text-sm font-mono text-zinc-300 mb-3">{tier.name}</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded bg-zinc-800/50 p-2">
                  <p className="text-zinc-500">Input</p>
                  <p className="text-zinc-300 font-mono">{tier.costIn}</p>
                </div>
                <div className="rounded bg-zinc-800/50 p-2">
                  <p className="text-zinc-500">Output</p>
                  <p className="text-zinc-300 font-mono">{tier.costOut}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Routing kosztowy per agent</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              { agent: '⚖️ Lex COO', primary: 'Gemini 3.0', fallback: '→ 3.1 Pro → GLM-5 → MiniMax', usage: 'Planowanie, delegacja' },
              { agent: '📋 Lex Intake', primary: 'GLM-5', fallback: '→ MiniMax → Gemini 3.0', usage: 'Ekstrakcja faktów, case cards' },
              { agent: '🔍 Lex Research', primary: 'GLM-5', fallback: '→ Gemini 3.1 Pro → 3.0 → MiniMax', usage: 'Memos, analiza prawna' },
              { agent: '✍️ Lex Draft', primary: 'GLM-5', fallback: '→ Gemini 3.1 Pro → 3.0 → MiniMax', usage: 'Drafty dokumentów' },
              { agent: '🛡️ Lex Control', primary: 'MiniMax M2.5', fallback: '→ GLM-5 → Gemini 3.0', usage: 'Checklists, compliance' },
              { agent: '🧠 Lex Memory', primary: 'MiniMax M2.5', fallback: '→ GLM-5 → Gemini 3.0', usage: 'Indeksowanie, tagging' },
            ].map((row) => (
              <div key={row.agent} className="flex items-center gap-4 p-2 rounded hover:bg-zinc-800/30">
                <span className="text-sm w-36">{row.agent}</span>
                <span className="text-xs font-mono text-blue-400 w-32">{row.primary}</span>
                <span className="text-xs text-zinc-600 flex-1">{row.fallback}</span>
                <span className="text-xs text-zinc-500 w-48 text-right">{row.usage}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
