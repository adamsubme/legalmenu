'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Link2, Upload, X } from 'lucide-react';
import { api } from '@/lib/api-client';

interface PendingAttachment {
  id: string;
  type: 'file' | 'link';
  name: string;
  file?: File;
  url?: string;
}

interface Client {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
}

interface CreateCaseFormProps {
  clients: Client[];
  projects: Project[];
  onCancel: () => void;
  onSuccess: () => void;
}

export function CreateCaseForm({ clients, projects, onCancel, onSuccess }: CreateCaseFormProps) {
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState('normal');
  const [newType, setNewType] = useState('');
  const [newClientId, setNewClientId] = useState('');
  const [newProjectId, setNewProjectId] = useState('');
  const [newLink, setNewLink] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [creating, setCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setPendingAttachments((prev) => [...prev, { id: crypto.randomUUID(), type: 'file', name: file.name, file }]);
    }
  };

  const addLink = () => {
    if (!newLink) return;
    setPendingAttachments((prev) => [...prev, { id: crypto.randomUUID(), type: 'link', name: newLink, url: newLink }]);
    setNewLink('');
  };

  const removeAttachment = (id: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const resetForm = () => {
    setNewTitle('');
    setNewDesc('');
    setNewPriority('normal');
    setNewType('');
    setNewClientId('');
    setNewProjectId('');
    setPendingAttachments([]);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);

    try {
      const task = await api.post<{ id: string }>('/tasks', {
        title: newTitle,
        description: newDesc,
        priority: newPriority,
        task_type: newType || undefined,
        client_id: newClientId || undefined,
        project_id: newProjectId || undefined,
        status: 'not_started',
      });

      for (const att of pendingAttachments) {
        if (att.type === 'file' && att.file) {
          const fd = new FormData();
          fd.append('file', att.file);
          fd.append('taskId', task.id);
          const uploadData = await api.upload<{ file_path: string; file_name: string; file_size: number; file_mime: string }>('/attachments/upload', fd);
          await api.post(`/tasks/${task.id}/attachments`, {
            attachment_type: 'file',
            title: att.name,
            file_path: uploadData.file_path,
            file_name: uploadData.file_name,
            file_size: uploadData.file_size,
            file_mime: uploadData.file_mime,
          });
        } else if (att.type === 'link' && att.url) {
          await api.post(`/tasks/${task.id}/attachments`, {
            attachment_type: 'link',
            title: att.name,
            url: att.url,
          });
        }
      }

      resetForm();
      onSuccess();
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card className="mt-4 border-blue-500/30 bg-blue-500/5">
      <CardContent className="p-4">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Input
              placeholder="Case title *"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              required
              className="col-span-2"
            />
            <select
              className="h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm"
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value)}
            >
              <option value="low">Low Priority</option>
              <option value="normal">Normal</option>
              <option value="high">High Priority</option>
              <option value="urgent">Urgent</option>
            </select>
            <select
              className="h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm"
              value={newClientId}
              onChange={(e) => setNewClientId(e.target.value)}
            >
              <option value="">Select client...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm"
              value={newProjectId}
              onChange={(e) => setNewProjectId(e.target.value)}
            >
              <option value="">Select project...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <Input
              placeholder="Case type (optional)"
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
            />
          </div>

          <textarea
            className="w-full h-20 bg-zinc-900 border border-zinc-700 rounded-md p-2 text-sm resize-none"
            placeholder="Description..."
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
          />

          {/* Attachments */}
          <div className="flex flex-wrap gap-2">
            {pendingAttachments.map((att) => (
              <div key={att.id} className="flex items-center gap-2 bg-zinc-800 rounded px-2 py-1">
                {att.type === 'file' ? (
                  <FileText className="h-4 w-4 text-blue-400" />
                ) : (
                  <Link2 className="h-4 w-4 text-cyan-400" />
                )}
                <span className="text-xs">{att.name}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(att.id)}
                  className="text-zinc-500 hover:text-red-400"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={addFile} />
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                Attach
              </Button>
              <div className="flex gap-1">
                <Input
                  placeholder="Paste link..."
                  value={newLink}
                  onChange={(e) => setNewLink(e.target.value)}
                  className="w-48 h-8 text-sm"
                />
                <Button type="button" variant="outline" size="sm" onClick={addLink}>
                  <Link2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? 'Creating...' : 'Create Case'}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
