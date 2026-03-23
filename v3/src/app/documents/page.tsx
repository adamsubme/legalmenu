'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { timeAgo } from '@/lib/utils';
import { FileText, Upload, Link2, StickyNote, Search, Paperclip, ExternalLink, Folder } from 'lucide-react';
import Link from 'next/link';

interface DocEntry {
  id: string;
  task_id: string;
  task_title?: string;
  attachment_type: string;
  title: string;
  url?: string;
  file_name?: string;
  file_size?: number;
  content?: string;
  created_at: string;
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<DocEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const tRes = await fetch('/api/tasks?workspace_id=default');
        if (!tRes.ok) return;
        const tasks = await tRes.json();
        const allDocs: DocEntry[] = [];

        for (const task of tasks) {
          try {
            const aRes = await fetch(`/api/tasks/${task.id}/attachments`);
            if (aRes.ok) {
              const atts = await aRes.json();
              if (Array.isArray(atts)) {
                for (const att of atts) {
                  allDocs.push({ ...att, task_title: task.title });
                }
              }
            }
          } catch {}
        }
        setDocs(allDocs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const filtered = docs.filter(d => {
    if (typeFilter && d.attachment_type !== typeFilter) return false;
    if (search && !d.title?.toLowerCase().includes(search.toLowerCase()) && !d.file_name?.toLowerCase().includes(search.toLowerCase()) && !d.task_title?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-400" /></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
          <p className="text-sm text-zinc-400 mt-1">{docs.length} attachments across all cases</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search documents..." className="pl-8 h-8 text-xs" />
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant={typeFilter === '' ? 'default' : 'ghost'} onClick={() => setTypeFilter('')}>All</Button>
          <Button size="sm" variant={typeFilter === 'file' ? 'default' : 'ghost'} onClick={() => setTypeFilter('file')}><Paperclip className="h-3 w-3 mr-1" />Files</Button>
          <Button size="sm" variant={typeFilter === 'link' ? 'default' : 'ghost'} onClick={() => setTypeFilter('link')}><Link2 className="h-3 w-3 mr-1" />Links</Button>
          <Button size="sm" variant={typeFilter === 'note' ? 'default' : 'ghost'} onClick={() => setTypeFilter('note')}><StickyNote className="h-3 w-3 mr-1" />Notes</Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Folder className="h-10 w-10 mx-auto text-zinc-600 mb-3" />
            <p className="text-lg font-medium text-zinc-300">No Documents</p>
            <p className="text-sm text-zinc-500 mt-1">Documents added to cases will appear here</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(doc => (
            <Card key={doc.id} className="hover:border-zinc-600 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  {doc.attachment_type === 'link' ? <Link2 className="h-5 w-5 text-blue-400 shrink-0" /> : doc.attachment_type === 'note' ? <StickyNote className="h-5 w-5 text-amber-400 shrink-0" /> : <FileText className="h-5 w-5 text-zinc-400 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.title || doc.file_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {doc.task_title && <Link href={`/case/${doc.task_id}`} className="text-xs text-blue-400 hover:text-blue-300 truncate max-w-[200px]">{doc.task_title}</Link>}
                      <span className="text-xs text-zinc-600">·</span>
                      <Badge variant="outline" className="text-[10px]">{doc.attachment_type}</Badge>
                      {doc.file_size && <span className="text-xs text-zinc-600">{(doc.file_size / 1024).toFixed(0)}KB</span>}
                      <span className="text-xs text-zinc-600">{timeAgo(doc.created_at)}</span>
                    </div>
                  </div>
                  {doc.url && <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300"><ExternalLink className="h-4 w-4" /></a>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
