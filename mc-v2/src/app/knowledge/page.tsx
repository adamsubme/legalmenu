'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BookOpen, Search, Database, FileText, ExternalLink } from 'lucide-react';

const KNOWLEDGE_BASE = [
  { category: 'MiCA Regulation', count: 1, desc: 'Rozporządzenie MiCA (EU 2023/1114) — pełny tekst' },
  { category: 'ESMA Documents', count: 55, desc: 'Guidelines, final reports, compliance tables, consultation papers, opinions' },
  { category: 'EBA Documents', count: 8, desc: 'Opinie, stanowiska, priorytety nadzorcze dot. ART/EMT' },
];

const TOPICS = [
  'CASP autoryzacja', 'Market abuse', 'Reverse solicitation',
  'Conflicts of interest', 'Suitability requirements', 'Knowledge & competence',
  'Stablecoins (ART/EMT)', 'Liquidity requirements', 'Operational resilience',
  'White papers', 'Crypto-asset classification', 'Compliance tables',
];

export default function KnowledgePage() {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (!search.trim()) return;
    setSearching(true);
    setTimeout(() => {
      setResults([
        'Matching documents would appear here after Vector Store search integration.',
        `Query: "${search}"`,
        'Vector Store ID: vs_69c069ceadc88191bbff088737bd11c3',
      ]);
      setSearching(false);
    }, 500);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Baza wiedzy</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Wyszukiwanie w bazie wektorowej — 65 dokumentów MiCA/ESMA/EBA
        </p>
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Szukaj w bazie wiedzy... np. 'CASP authorization requirements'"
                className="pl-10"
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch} disabled={searching}>
              {searching ? 'Szukam...' : 'Szukaj'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Database className="h-5 w-5 text-blue-400" />
            <div>
              <p className="text-2xl font-bold">65</p>
              <p className="text-xs text-zinc-500">Dokumentów w bazie</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <FileText className="h-5 w-5 text-purple-400" />
            <div>
              <p className="text-2xl font-bold">3</p>
              <p className="text-xs text-zinc-500">Źródła (MiCA, ESMA, EBA)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-emerald-400" />
            <div>
              <p className="text-sm font-mono text-zinc-300">vs_69c069ce...</p>
              <p className="text-xs text-zinc-500">Vector Store ID</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Wyniki wyszukiwania</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {results.map((r, i) => (
                <p key={i} className="text-sm text-zinc-400">{r}</p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-4">
        {KNOWLEDGE_BASE.map((kb) => (
          <Card key={kb.category}>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                {kb.category}
                <Badge variant="info">{kb.count} doc{kb.count > 1 ? 's' : ''}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-zinc-500">{kb.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tematy w bazie</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {TOPICS.map((topic) => (
              <button
                key={topic}
                onClick={() => { setSearch(topic); handleSearch(); }}
                className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
              >
                {topic}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
