'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AGENT_MAP } from '@/lib/utils';
import { ArrowLeft, Save, Plus, Trash2, BookOpen, Wrench, Brain, Settings, FileText, RefreshCw } from 'lucide-react';
import type { AgentFileInfo, AgentLesson, ModelConfig } from '@/lib/types-v3';

type AgentTab = 'identity' | 'config' | 'skills' | 'knowledge' | 'lessons';

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;

  const info = AGENT_MAP[agentId] || { name: agentId, emoji: '🤖', role: 'Agent', primaryModel: '—', tier: '—' };

  const [tab, setTab] = useState<AgentTab>('identity');
  const [files, setFiles] = useState<AgentFileInfo[]>([]);
  const [lessons, setLessons] = useState<AgentLesson[]>([]);
  const [modelConfig, setModelConfig] = useState<ModelConfig | null>(null);
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [newLesson, setNewLesson] = useState('');
  const [newCategory, setNewCategory] = useState('general');
  const [knowledgeUrl, setKnowledgeUrl] = useState('');
  const [knowledgeTitle, setKnowledgeTitle] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [fRes, lRes, mRes] = await Promise.all([
        fetch(`/api/agents/${agentId}/files`),
        fetch(`/api/agents/${agentId}/lessons`),
        fetch(`/api/agents/${agentId}/model`),
      ]);
      if (fRes.ok) setFiles(await fRes.json());
      if (lRes.ok) setLessons(await lRes.json());
      if (mRes.ok) {
        const d = await mRes.json();
        setModelConfig(d.model || null);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [agentId]);

  useEffect(() => { loadData(); }, [loadData]);

  const saveFile = async (fileName: string, dir: string, content: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/files`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName, dir, content }),
      });
      if (res.ok) { setEditingFile(null); loadData(); }
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const saveModel = async () => {
    if (!modelConfig) return;
    setSaving(true);
    try {
      await fetch(`/api/agents/${agentId}/model`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelConfig }),
      });
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const addLesson = async () => {
    if (!newLesson.trim()) return;
    try {
      await fetch(`/api/agents/${agentId}/lessons`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lesson: newLesson, category: newCategory }),
      });
      setNewLesson('');
      loadData();
    } catch (e) { console.error(e); }
  };

  const addKnowledgeLink = async () => {
    if (!knowledgeUrl.trim()) return;
    try {
      await fetch('/api/knowledge', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: knowledgeTitle || knowledgeUrl, source_type: 'link', source_url: knowledgeUrl, tags: agentId }),
      });
      setKnowledgeUrl('');
      setKnowledgeTitle('');
    } catch (e) { console.error(e); }
  };

  const tabs: { id: AgentTab; label: string; icon: React.ElementType }[] = [
    { id: 'identity', label: 'Identity', icon: FileText },
    { id: 'config', label: 'Configuration', icon: Settings },
    { id: 'skills', label: 'Skills', icon: Wrench },
    { id: 'knowledge', label: 'Knowledge', icon: BookOpen },
    { id: 'lessons', label: 'Lessons', icon: Brain },
  ];

  if (loading) return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-400" /></div>;

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center gap-3 border-b border-zinc-800 px-6 py-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/agents')}><ArrowLeft className="h-4 w-4" /></Button>
        <span className="text-2xl">{info.emoji}</span>
        <div>
          <h1 className="text-lg font-semibold">{info.name}</h1>
          <p className="text-xs text-zinc-500">{info.role} · {info.primaryModel}</p>
        </div>
        <div className="ml-auto">
          <Badge variant="outline">{info.tier}</Badge>
        </div>
      </div>

      <div className="flex items-center border-b border-zinc-800 px-6">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 px-3 py-2.5 text-sm border-b-2 transition-colors ${tab === t.id ? 'border-blue-400 text-zinc-100' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>
            <t.icon className="h-3.5 w-3.5" />{t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'identity' && (
          <div className="space-y-4 max-w-4xl">
            {files.map(f => (
              <Card key={f.name}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-mono flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-zinc-500" />
                      {f.name}
                      <span className="text-xs text-zinc-600 font-normal">({f.dir}/)</span>
                    </CardTitle>
                    <div className="flex gap-2">
                      {editingFile === f.name ? (
                        <>
                          <Button size="sm" onClick={() => saveFile(f.name, (f as unknown as { dir: string }).dir, fileContent)} disabled={saving}><Save className="h-3 w-3 mr-1" />Save</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingFile(null)}>Cancel</Button>
                        </>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => { setEditingFile(f.name); setFileContent(f.content); }}>Edit</Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {editingFile === f.name ? (
                    <textarea
                      value={fileContent}
                      onChange={e => setFileContent(e.target.value)}
                      className="w-full min-h-[300px] rounded-md border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs text-zinc-200 focus:border-blue-500 focus:outline-none"
                      spellCheck={false}
                    />
                  ) : (
                    <pre className="whitespace-pre-wrap text-xs text-zinc-400 leading-relaxed max-h-48 overflow-y-auto">{f.content || '(empty)'}</pre>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {tab === 'config' && (
          <div className="space-y-6 max-w-2xl">
            <Card>
              <CardHeader><CardTitle className="text-sm">Model Configuration</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Primary Model</label>
                  <Input
                    value={modelConfig?.primary || ''}
                    onChange={e => setModelConfig(prev => prev ? { ...prev, primary: e.target.value } : { primary: e.target.value, fallbacks: [] })}
                    className="font-mono text-xs"
                    placeholder="e.g. google/gemini-3-pro-preview"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Fallback Models (one per line)</label>
                  <textarea
                    value={modelConfig?.fallbacks?.join('\n') || ''}
                    onChange={e => setModelConfig(prev => prev ? { ...prev, fallbacks: e.target.value.split('\n').filter(Boolean) } : { primary: '', fallbacks: e.target.value.split('\n').filter(Boolean) })}
                    className="w-full min-h-[100px] rounded-md border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs text-zinc-200 focus:border-blue-500 focus:outline-none"
                    placeholder={"google/gemini-3-pro-preview\nzai/glm-5\nminimax/MiniMax-M2.5"}
                  />
                </div>
                <Button onClick={saveModel} disabled={saving}><Save className="h-3.5 w-3.5 mr-1" />Save Model Config</Button>
              </CardContent>
            </Card>
          </div>
        )}

        {tab === 'skills' && (
          <div className="max-w-2xl">
            <Card>
              <CardHeader><CardTitle className="text-sm">Enabled Skills</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {['gemini', 'gog', 'nano-pdf', 'oracle', 'session-logs', 'summarize', 'weather', 'notion', 'document-convert', 'browser'].map(skill => (
                    <div key={skill} className="flex items-center justify-between p-2 rounded-md border border-zinc-800 bg-zinc-900/50">
                      <div className="flex items-center gap-2">
                        <Wrench className="h-3 w-3 text-zinc-500" />
                        <span className="text-sm">{skill}</span>
                      </div>
                      <Badge variant="success" className="text-[10px]">active</Badge>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-zinc-500 mt-3">Skills are configured globally in openclaw.json. Changes apply to all agents.</p>
              </CardContent>
            </Card>
          </div>
        )}

        {tab === 'knowledge' && (
          <div className="space-y-4 max-w-2xl">
            <Card>
              <CardHeader><CardTitle className="text-sm">Add Knowledge Link</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Input value={knowledgeTitle} onChange={e => setKnowledgeTitle(e.target.value)} placeholder="Title (optional)" className="h-8 text-xs" />
                <div className="flex gap-2">
                  <Input value={knowledgeUrl} onChange={e => setKnowledgeUrl(e.target.value)} placeholder="URL to index..." className="flex-1 h-8 text-xs" />
                  <Button size="sm" onClick={addKnowledgeLink} disabled={!knowledgeUrl}><Plus className="h-3 w-3 mr-1" />Add</Button>
                </div>
                <p className="text-xs text-zinc-500">Links will be tagged with this agent's ID and added to the knowledge base for vector indexing.</p>
              </CardContent>
            </Card>
          </div>
        )}

        {tab === 'lessons' && (
          <div className="space-y-4 max-w-2xl">
            <Card>
              <CardHeader><CardTitle className="text-sm">Add Lesson</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <textarea
                  value={newLesson}
                  onChange={e => setNewLesson(e.target.value)}
                  placeholder="Document what this agent learned..."
                  className="w-full min-h-[80px] rounded-md border border-zinc-700 bg-zinc-950 p-3 text-xs text-zinc-200 focus:border-blue-500 focus:outline-none"
                />
                <div className="flex gap-2">
                  <select value={newCategory} onChange={e => setNewCategory(e.target.value)} className="h-8 rounded-md border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-300">
                    <option value="general">General</option><option value="legal">Legal</option><option value="procedure">Procedure</option><option value="client">Client</option><option value="mistake">Mistake</option>
                  </select>
                  <Button size="sm" onClick={addLesson} disabled={!newLesson.trim()}><Plus className="h-3 w-3 mr-1" />Save Lesson</Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              {lessons.length === 0 ? <p className="text-sm text-zinc-500 text-center py-4">No lessons recorded</p> : (
                lessons.map(l => (
                  <Card key={l.id}>
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2">
                        <Brain className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm text-zinc-200">{l.lesson}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-[10px]">{l.category}</Badge>
                            <span className="text-[10px] text-zinc-600">{new Date(l.created_at).toLocaleDateString('en-US')}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
