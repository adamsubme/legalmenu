'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Mail, Phone, MessageCircle, ArrowLeft, ExternalLink, Calendar, Folder, Plus, Trash2, Link2, FileText, BookOpen, Upload, X } from 'lucide-react';
import Link from 'next/link';
import type { ClientWithStats, Project, KnowledgeEntry } from '@/lib/types';

type ClientFile = {
  id: string;
  client_id: string;
  attachment_type: 'file' | 'link' | 'note';
  title: string;
  url?: string;
  file_path?: string;
  file_name?: string;
  file_size?: number;
  file_mime?: string;
  content?: string;
  created_at: string;
};

type Tab = 'info' | 'files' | 'links' | 'knowledge' | 'projects';

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [client, setClient] = useState<ClientWithStats | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [files, setFiles] = useState<ClientFile[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('info');
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', telegram_username: '' });
  
  // File/Link form state
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [docType, setDocType] = useState<'file' | 'link' | 'note'>('link');
  const [docTitle, setDocTitle] = useState('');
  const [docUrl, setDocUrl] = useState('');
  const [docContent, setDocContent] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Knowledge form state
  const [showAddKnowledge, setShowAddKnowledge] = useState(false);
  const [kbTitle, setKbTitle] = useState('');
  const [kbContent, setKbContent] = useState('');
  const [kbType, setKbType] = useState<'document' | 'template' | 'precedent' | 'memo'>('document');
  const [kbTags, setKbTags] = useState('');

  useEffect(() => {
    loadClient();
  }, [id]);

  async function loadClient() {
    try {
      const [clientRes, filesRes, kbRes] = await Promise.all([
        fetch(`/api/clients/${id}`, { credentials: 'include' }),
        fetch(`/api/clients/${id}/files`, { credentials: 'include' }),
        fetch(`/api/knowledge?scope=client&scope_id=${id}`, { credentials: 'include' }),
      ]);
      
      if (clientRes.ok) {
        const data = await clientRes.json();
        setClient(data);
        setFormData({
          name: data.name,
          email: data.email || '',
          phone: data.phone || '',
          telegram_username: data.telegram_username || '',
        });
        
        // Load projects
        const projectsRes = await fetch(`/api/projects?client_id=${id}`, { credentials: 'include' });
        if (projectsRes.ok) {
          setProjects(await projectsRes.json());
        }
      }
      
      if (filesRes.ok) {
        const f = await filesRes.json();
        setFiles(Array.isArray(f) ? f : []);
      }
      
      if (kbRes.ok) {
        const k = await kbRes.json();
        setKnowledge(Array.isArray(k) ? k : []);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials: 'include',
      });
      if (res.ok) {
        setEditing(false);
        loadClient();
      }
    } catch (e) { console.error(e); }
  }

  async function addDocument() {
    if (docType === 'link' && !docUrl) return;
    
    try {
      const body: Record<string, unknown> = {
        attachment_type: docType,
        title: docTitle || (docType === 'link' ? docUrl : 'Note'),
      };
      
      if (docType === 'link') body.url = docUrl;
      if (docType === 'note') body.content = docContent;
      
      const res = await fetch(`/api/clients/${id}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      });
      
      if (res.ok) {
        setDocTitle('');
        setDocUrl('');
        setDocContent('');
        setShowAddDoc(false);
        loadClient();
      }
    } catch (e) { console.error(e); }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('taskId', id);
      
      const uploadRes = await fetch('/api/attachments/upload', { method: 'POST', body: fd, credentials: 'include' });
      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        await fetch(`/api/clients/${id}/files`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attachment_type: 'file',
            title: file.name,
            file_path: uploadData.file_path,
            file_name: uploadData.file_name,
            file_size: uploadData.file_size,
            file_mime: uploadData.file_mime,
          }),
          credentials: 'include',
        });
        loadClient();
      }
    } catch (e) { console.error(e); }
    finally { setUploading(false); }
  }

  async function addKnowledge() {
    if (!kbTitle || !kbContent) return;
    
    try {
      const res = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: kbTitle,
          content: kbContent,
          scope: 'client',
          scope_id: id,
          entry_type: kbType,
          tags: kbTags,
        }),
        credentials: 'include',
      });
      
      if (res.ok) {
        setKbTitle('');
        setKbContent('');
        setKbTags('');
        setShowAddKnowledge(false);
        loadClient();
      }
    } catch (e) { console.error(e); }
  }

  async function deleteFile(fileId: string) {
    try {
      await fetch(`/api/clients/${id}/files?file_id=${fileId}`, { method: 'DELETE', credentials: 'include' });
      loadClient();
    } catch (e) { console.error(e); }
  }

  async function deleteKnowledge(kbId: string) {
    try {
      await fetch(`/api/knowledge/${kbId}`, { method: 'DELETE', credentials: 'include' });
      loadClient();
    } catch (e) { console.error(e); }
  }

  if (loading) {
    return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-400" /></div>;
  }

  if (!client) {
    return <div className="p-6 text-zinc-500">Client not found</div>;
  }

  const links = files.filter(f => f.attachment_type === 'link');
  const notes = files.filter(f => f.attachment_type === 'note');
  const clientFiles = files.filter(f => f.attachment_type === 'file');

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/clients">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{client.name}</h1>
          <p className="text-sm text-zinc-400">Client</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => router.push(`/projects?client_id=${id}&new=1`)}>
          <Plus className="h-4 w-4 mr-2" />New Project
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="info">Info</TabsTrigger>
          <TabsTrigger value="files">Files ({clientFiles.length})</TabsTrigger>
          <TabsTrigger value="links">Links ({links.length})</TabsTrigger>
          <TabsTrigger value="knowledge">Knowledge ({knowledge.length})</TabsTrigger>
          <TabsTrigger value="projects">Projects ({projects.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Contact Information</span>
                <Button variant="ghost" size="sm" onClick={() => setEditing(!editing)}>
                  {editing ? 'Cancel' : 'Edit'}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {editing ? (
                <form onSubmit={handleUpdate} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-zinc-400">Name</label>
                      <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400">Email</label>
                      <Input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400">Phone</label>
                      <Input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400">Telegram</label>
                      <Input value={formData.telegram_username} onChange={e => setFormData({ ...formData, telegram_username: e.target.value })} />
                    </div>
                  </div>
                  <Button type="submit">Save Changes</Button>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-zinc-500" />
                    <span>{client.email || 'No email'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-zinc-500" />
                    <span>{client.phone || 'No phone'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <MessageCircle className="h-4 w-4 text-zinc-500" />
                    <span>{client.telegram_username ? `@${client.telegram_username}` : 'No Telegram'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-zinc-500" />
                    <span>Created: {new Date(client.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="files" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Client Files</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setDocType('file'); setShowAddDoc(true); }}>
                    <Upload className="h-4 w-4 mr-2" />Upload
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setDocType('note'); setShowAddDoc(true); }}>
                    <Plus className="h-4 w-4 mr-2" />Add Note
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {showAddDoc && docType === 'file' && (
                <div className="mb-4 p-4 border border-zinc-700 rounded-lg">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-400">Select file to upload</span>
                    <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                      {uploading ? 'Uploading...' : 'Choose File'}
                    </Button>
                  </div>
                </div>
              )}
              
              {showAddDoc && docType === 'note' && (
                <div className="mb-4 p-4 border border-zinc-700 rounded-lg space-y-3">
                  <Input placeholder="Note title" value={docTitle} onChange={e => setDocTitle(e.target.value)} />
                  <textarea
                    className="w-full h-24 bg-zinc-900 border border-zinc-700 rounded-md p-2 text-sm"
                    placeholder="Note content..."
                    value={docContent}
                    onChange={e => setDocContent(e.target.value)}
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setShowAddDoc(false)}>Cancel</Button>
                    <Button size="sm" onClick={addDocument}>Save Note</Button>
                  </div>
                </div>
              )}
              
              {clientFiles.length === 0 ? (
                <p className="text-sm text-zinc-500 py-8 text-center">No files uploaded</p>
              ) : (
                <div className="space-y-2">
                  {clientFiles.map(f => (
                    <div key={f.id} className="flex items-center gap-3 p-3 rounded-lg border border-zinc-800 hover:bg-zinc-800/50">
                      <FileText className="h-5 w-5 text-blue-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{f.title}</p>
                        <p className="text-xs text-zinc-500">{f.file_name} • {f.file_size ? (f.file_size / 1024).toFixed(1) : 0}KB</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => deleteFile(f.id)}>
                        <Trash2 className="h-4 w-4 text-zinc-500 hover:text-red-400" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="links" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Useful Links</span>
                <Button variant="outline" size="sm" onClick={() => { setDocType('link'); setShowAddDoc(true); }}>
                  <Plus className="h-4 w-4 mr-2" />Add Link
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {showAddDoc && docType === 'link' && (
                <div className="mb-4 p-4 border border-zinc-700 rounded-lg space-y-3">
                  <Input placeholder="Link title" value={docTitle} onChange={e => setDocTitle(e.target.value)} />
                  <Input type="url" placeholder="https://..." value={docUrl} onChange={e => setDocUrl(e.target.value)} />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setShowAddDoc(false)}>Cancel</Button>
                    <Button size="sm" onClick={addDocument}>Save Link</Button>
                  </div>
                </div>
              )}
              
              {links.length === 0 ? (
                <p className="text-sm text-zinc-500 py-8 text-center">No links added</p>
              ) : (
                <div className="space-y-2">
                  {links.map(l => (
                    <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-lg border border-zinc-800 hover:bg-zinc-800/50 group">
                      <Link2 className="h-5 w-5 text-blue-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate group-hover:text-blue-400">{l.title}</p>
                        <p className="text-xs text-zinc-500 truncate">{l.url}</p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400" />
                      <Button variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); deleteFile(l.id); }}>
                        <Trash2 className="h-4 w-4 text-zinc-500 hover:text-red-400" />
                      </Button>
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          
          {notes.length > 0 && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {notes.map(n => (
                    <div key={n.id} className="p-3 rounded-lg border border-zinc-800">
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="text-xs text-zinc-400 mt-1">{n.content}</p>
                      <div className="flex justify-end mt-2">
                        <Button variant="ghost" size="icon" onClick={() => deleteFile(n.id)}>
                          <Trash2 className="h-4 w-4 text-zinc-500 hover:text-red-400" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="knowledge" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Client Knowledge Base</span>
                <Button variant="outline" size="sm" onClick={() => setShowAddKnowledge(true)}>
                  <Plus className="h-4 w-4 mr-2" />Add Entry
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {showAddKnowledge && (
                <div className="mb-4 p-4 border border-zinc-700 rounded-lg space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <Input placeholder="Entry title" value={kbTitle} onChange={e => setKbTitle(e.target.value)} />
                    <select
                      className="bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm"
                      value={kbType}
                      onChange={e => setKbType(e.target.value as typeof kbType)}
                    >
                      <option value="document">Document</option>
                      <option value="template">Template</option>
                      <option value="precedent">Precedent</option>
                      <option value="memo">Memo</option>
                    </select>
                  </div>
                  <textarea
                    className="w-full h-32 bg-zinc-900 border border-zinc-700 rounded-md p-2 text-sm"
                    placeholder="Content..."
                    value={kbContent}
                    onChange={e => setKbContent(e.target.value)}
                  />
                  <Input placeholder="Tags (comma separated)" value={kbTags} onChange={e => setKbTags(e.target.value)} />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setShowAddKnowledge(false)}>Cancel</Button>
                    <Button size="sm" onClick={addKnowledge}>Save Entry</Button>
                  </div>
                </div>
              )}
              
              {knowledge.length === 0 ? (
                <p className="text-sm text-zinc-500 py-8 text-center">No knowledge entries</p>
              ) : (
                <div className="space-y-2">
                  {knowledge.map(k => (
                    <div key={k.id} className="p-4 rounded-lg border border-zinc-800 hover:bg-zinc-800/50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{k.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">{k.entry_type}</Badge>
                            {k.tags && k.tags.split(',').map(t => (
                              <Badge key={t} variant="secondary" className="text-xs">{t.trim()}</Badge>
                            ))}
                          </div>
                          <p className="text-xs text-zinc-500 mt-2 line-clamp-2">{k.content}</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => deleteKnowledge(k.id)}>
                          <Trash2 className="h-4 w-4 text-zinc-500 hover:text-red-400" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="projects" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Client Projects</span>
                <Button variant="outline" size="sm" onClick={() => router.push(`/projects?client_id=${id}&new=1`)}>
                  <Plus className="h-4 w-4 mr-2" />New Project
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {projects.length === 0 ? (
                <p className="text-sm text-zinc-500 py-8 text-center">No projects</p>
              ) : (
                <div className="space-y-2">
                  {projects.map(p => (
                    <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center gap-3 p-3 rounded-lg border border-zinc-800 hover:bg-zinc-800/50 group">
                      <Folder className="h-5 w-5 text-amber-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate group-hover:text-blue-400">{p.name}</p>
                        <p className="text-xs text-zinc-500">{p.description || 'No description'}</p>
                      </div>
                      <Badge variant={p.status === 'active' ? 'success' : 'secondary'}>{p.status}</Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
