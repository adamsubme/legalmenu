'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { timeAgo } from '@/lib/utils';
import { BookOpen, Search, Upload, Plus, Trash2, Link2, FileText, Database, RefreshCw } from 'lucide-react';
import type { KnowledgeEntry } from '@/lib/types';
import { api } from '@/lib/api-client';

export default function KnowledgePage() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<unknown[]>([]);
  const [searching, setSearching] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newEntry, setNewEntry] = useState<{ title: string; source_type: 'link' | 'file' | 'document'; source_url: string; description: string; tags: string }>({ title: '', source_type: 'link', source_url: '', description: '', tags: '' });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadEntries();
  }, []);

  async function loadEntries() {
    try {
      const data = await api.get<KnowledgeEntry[]>('/knowledge');
      setEntries(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const data = await api.post<{ data?: unknown[]; results?: unknown[] }>('/knowledge/search', { query: searchQuery, limit: 10 });
      setSearchResults(data.data || data.results || []);
    } catch (e) { console.error(e); }
    finally { setSearching(false); }
  }

  async function addEntry() {
    if (!newEntry.title.trim()) return;
    try {
      await api.post('/knowledge', newEntry);
      setNewEntry({ title: '', source_type: 'link', source_url: '', description: '', tags: '' });
      setShowAdd(false);
      loadEntries();
    } catch (e) { console.error(e); }
  }

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', file.name);
      await api.upload('/knowledge/upload', fd);
      loadEntries();
    } catch (e) { console.error(e); }
    finally { setUploading(false); }
  }

  async function deleteEntry(id: string) {
    try {
      await api.delete(`/knowledge?id=${id}`);
      loadEntries();
    } catch (e) { console.error(e); }
  }

  if (loading) return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-400" /></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Knowledge Base</h1>
          <p className="text-sm text-zinc-400 mt-1">{entries.length} entries · OpenAI Vector Store</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowAdd(!showAdd)}><Plus className="h-3.5 w-3.5 mr-1" />Add Entry</Button>
          <label>
            <input type="file" ref={fileRef} className="hidden" accept=".pdf,.docx,.txt,.md,.csv" onChange={e => e.target.files?.[0] && uploadFile(e.target.files[0])} />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
              Upload File
            </Button>
          </label>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Search className="h-4 w-4 text-blue-400" />Semantic Search</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search the knowledge base... e.g. 'MiCA requirements for stablecoin issuers'" className="flex-1" onKeyDown={e => e.key === 'Enter' && handleSearch()} />
            <Button onClick={handleSearch} disabled={searching || !searchQuery.trim()}>
              {searching ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          {searchResults.length > 0 && (
            <div className="mt-4 space-y-3">
              <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Search Results</h4>
              {searchResults.map((r: unknown, i) => {
                const result = r as { score?: number; content?: Array<{ text?: string; type?: string }>; file_id?: string };
                return (
                  <div key={i} className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px]">Score: {result.score ? (result.score * 100).toFixed(1) + '%' : '—'}</Badge>
                      {result.file_id && <span className="text-[10px] text-zinc-600 font-mono">{result.file_id}</span>}
                    </div>
                    {result.content?.map((c, ci) => (
                      <p key={ci} className="text-xs text-zinc-400 leading-relaxed mt-1 line-clamp-4">{c.text || JSON.stringify(c)}</p>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {showAdd && (
        <Card className="animate-slide-in">
          <CardHeader><CardTitle className="text-sm">Add Knowledge Entry</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-3">
              <Input value={newEntry.title} onChange={e => setNewEntry(p => ({ ...p, title: e.target.value }))} placeholder="Title" className="flex-1 h-8 text-xs" />
              <select value={newEntry.source_type} onChange={e => setNewEntry(p => ({ ...p, source_type: e.target.value as 'link' | 'file' | 'document' }))} className="h-8 rounded-md border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-300">
                <option value="link">Link</option><option value="file">File</option><option value="document">Document</option>
              </select>
            </div>
            <Input value={newEntry.source_url} onChange={e => setNewEntry(p => ({ ...p, source_url: e.target.value }))} placeholder="URL" className="h-8 text-xs" />
            <Input value={newEntry.tags} onChange={e => setNewEntry(p => ({ ...p, tags: e.target.value }))} placeholder="Tags (comma-separated)" className="h-8 text-xs" />
            <textarea value={newEntry.description} onChange={e => setNewEntry(p => ({ ...p, description: e.target.value }))} placeholder="Description..." className="w-full min-h-[60px] rounded-md border border-zinc-700 bg-zinc-950 p-3 text-xs text-zinc-200 focus:border-blue-500 focus:outline-none" />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button size="sm" onClick={addEntry} disabled={!newEntry.title.trim()}>Save</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <h3 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2"><Database className="h-4 w-4 text-blue-400" />Indexed Entries</h3>
        {entries.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <BookOpen className="h-8 w-8 mx-auto text-zinc-600 mb-2" />
              <p className="text-sm text-zinc-500">No entries yet. Upload documents or add links.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {entries.map(entry => (
              <Card key={entry.id} className="hover:border-zinc-600 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    {(entry as { entry_type?: string }).entry_type === 'link' ? <Link2 className="h-5 w-5 text-blue-400 shrink-0" /> : <FileText className="h-5 w-5 text-zinc-400 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{entry.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <Badge variant={(entry as { status?: string }).status === 'indexed' ? 'success' : (entry as { status?: string }).status === 'failed' ? 'destructive' : 'warning'} className="text-[10px]">{(entry as { status?: string }).status}</Badge>
                        <Badge variant="outline" className="text-[10px]">{(entry as { entry_type?: string }).entry_type}</Badge>
                        {entry.tags && entry.tags.split(',').map(t => <Badge key={t} variant="outline" className="text-[10px]">{t.trim()}</Badge>)}
                        {(entry as { file_size?: number }).file_size && <span className="text-xs text-zinc-600">{((entry as { file_size?: number }).file_size! / 1024).toFixed(0)}KB</span>}
                        <span className="text-xs text-zinc-600">{timeAgo(entry.created_at)}</span>
                      </div>
                      {(entry as { description?: string }).description && <p className="text-xs text-zinc-500 mt-1 line-clamp-1">{(entry as { description?: string }).description}</p>}
                    </div>
                    <Button variant="ghost" size="icon" className="text-zinc-500 hover:text-red-400" onClick={() => deleteEntry(entry.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
