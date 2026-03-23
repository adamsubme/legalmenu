/**
 * CaseDocuments — attachments panel for legal cases
 * Supports: file upload, links, notes
 */
'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Paperclip, Link as LinkIcon, StickyNote, Upload, Trash2,
  Download, ExternalLink, FileText, File, FileImage,
  FileBadge, Plus, X, ChevronDown, ChevronUp, Loader2,
} from 'lucide-react';
import type { TaskAttachment, AttachmentType } from '@/lib/types';

interface CaseDocumentsProps {
  taskId: string;
}

type AddMode = null | 'file' | 'link' | 'note';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(ts: string): string {
  return new Date(ts).toLocaleDateString('pl-PL', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function getMimeIcon(mime?: string, fileName?: string) {
  const m = mime || '';
  const ext = (fileName || '').split('.').pop()?.toLowerCase() || '';
  if (m.startsWith('image/')) return <FileImage className="w-5 h-5 text-purple-400" />;
  if (m === 'application/pdf' || ext === 'pdf') return <FileBadge className="w-5 h-5 text-red-400" />;
  if (['doc', 'docx'].includes(ext) || m.includes('word')) return <FileText className="w-5 h-5 text-blue-400" />;
  if (['xls', 'xlsx'].includes(ext) || m.includes('spreadsheet')) return <FileText className="w-5 h-5 text-green-400" />;
  if (['txt', 'md'].includes(ext) || m.startsWith('text/')) return <FileText className="w-5 h-5 text-mc-text-secondary" />;
  return <File className="w-5 h-5 text-mc-text-secondary" />;
}

export function CaseDocuments({ taskId }: CaseDocumentsProps) {
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [addMode, setAddMode] = useState<AddMode>(null);
  const [uploading, setUploading] = useState(false);
  const [expandedNote, setExpandedNote] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Link form
  const [linkForm, setLinkForm] = useState({ title: '', url: '', description: '' });
  // Note form
  const [noteForm, setNoteForm] = useState({ title: '', content: '' });

  useEffect(() => {
    loadAttachments();
  }, [taskId]);

  const loadAttachments = async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/attachments`);
      if (res.ok) setAttachments(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const results: TaskAttachment[] = [];

    for (const file of Array.from(files)) {
      try {
        // 1. Upload binary
        const fd = new FormData();
        fd.append('file', file);
        fd.append('taskId', taskId);
        const upRes = await fetch('/api/attachments/upload', { method: 'POST', body: fd });
        if (!upRes.ok) { console.error('Upload failed', file.name); continue; }
        const { file_path, file_name, file_size, file_mime } = await upRes.json();

        // 2. Create attachment record
        const attRes = await fetch(`/api/tasks/${taskId}/attachments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            attachment_type: 'file',
            title: file.name,
            file_path,
            file_name,
            file_size,
            file_mime,
          }),
        });
        if (attRes.ok) results.push(await attRes.json());
      } catch (err) {
        console.error('Error uploading', file.name, err);
      }
    }

    setAttachments((prev) => [...results, ...prev]);
    setUploading(false);
    setAddMode(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddLink = async () => {
    if (!linkForm.title || !linkForm.url) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attachment_type: 'link', ...linkForm }),
      });
      if (res.ok) {
        const newAtt = await res.json();
        setAttachments((prev) => [newAtt, ...prev]);
        setLinkForm({ title: '', url: '', description: '' });
        setAddMode(null);
      }
    } catch (e) { console.error(e); }
  };

  const handleAddNote = async () => {
    if (!noteForm.title || !noteForm.content) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attachment_type: 'note', ...noteForm }),
      });
      if (res.ok) {
        const newAtt = await res.json();
        setAttachments((prev) => [newAtt, ...prev]);
        setNoteForm({ title: '', content: '' });
        setAddMode(null);
      }
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (att: TaskAttachment) => {
    if (!confirm(`Usuń "${att.title}"?`)) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}/attachments/${att.id}`, { method: 'DELETE' });
      if (res.ok) setAttachments((prev) => prev.filter((a) => a.id !== att.id));
    } catch (e) { console.error(e); }
  };

  const handleDownload = (att: TaskAttachment) => {
    if (att.file_path) {
      window.open(`/api/attachments/download?path=${encodeURIComponent(att.file_path)}`, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-mc-text-secondary">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Ładowanie dokumentów...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setAddMode(addMode === 'file' ? null : 'file')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${addMode === 'file' ? 'bg-mc-accent text-mc-bg' : 'bg-mc-bg-tertiary text-mc-text hover:bg-mc-border'}`}
        >
          <Upload className="w-4 h-4" /> Prześlij plik
        </button>
        <button
          onClick={() => setAddMode(addMode === 'link' ? null : 'link')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${addMode === 'link' ? 'bg-mc-accent text-mc-bg' : 'bg-mc-bg-tertiary text-mc-text hover:bg-mc-border'}`}
        >
          <LinkIcon className="w-4 h-4" /> Dodaj link
        </button>
        <button
          onClick={() => setAddMode(addMode === 'note' ? null : 'note')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${addMode === 'note' ? 'bg-mc-accent text-mc-bg' : 'bg-mc-bg-tertiary text-mc-text hover:bg-mc-border'}`}
        >
          <StickyNote className="w-4 h-4" /> Notatka
        </button>
      </div>

      {/* File upload panel */}
      {addMode === 'file' && (
        <div className="p-4 bg-mc-bg rounded-lg border border-dashed border-mc-accent/50 space-y-3">
          <p className="text-sm text-mc-text-secondary">Przeciągnij pliki lub kliknij, aby wybrać (PDF, DOCX, JPG, ...)</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileChange}
            className="block w-full text-sm text-mc-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-mc-accent file:text-mc-bg hover:file:bg-mc-accent/80 cursor-pointer"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.md,.jpg,.jpeg,.png,.gif,.zip,.rar"
          />
          {uploading && (
            <div className="flex items-center gap-2 text-sm text-mc-accent">
              <Loader2 className="w-4 h-4 animate-spin" /> Przesyłanie...
            </div>
          )}
        </div>
      )}

      {/* Link form */}
      {addMode === 'link' && (
        <div className="p-4 bg-mc-bg rounded-lg border border-mc-border space-y-3">
          <input
            type="text"
            placeholder="Tytuł *"
            value={linkForm.title}
            onChange={(e) => setLinkForm({ ...linkForm, title: e.target.value })}
            className="w-full bg-mc-bg-secondary border border-mc-border rounded px-3 py-2 text-sm focus:outline-none focus:border-mc-accent"
          />
          <input
            type="url"
            placeholder="URL *  (https://...)"
            value={linkForm.url}
            onChange={(e) => setLinkForm({ ...linkForm, url: e.target.value })}
            className="w-full bg-mc-bg-secondary border border-mc-border rounded px-3 py-2 text-sm focus:outline-none focus:border-mc-accent"
          />
          <input
            type="text"
            placeholder="Opis (opcjonalnie)"
            value={linkForm.description}
            onChange={(e) => setLinkForm({ ...linkForm, description: e.target.value })}
            className="w-full bg-mc-bg-secondary border border-mc-border rounded px-3 py-2 text-sm focus:outline-none focus:border-mc-accent"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAddLink}
              disabled={!linkForm.title || !linkForm.url}
              className="flex items-center gap-1.5 px-4 py-2 bg-mc-accent text-mc-bg rounded text-sm font-medium disabled:opacity-40"
            >
              <Plus className="w-4 h-4" /> Dodaj
            </button>
            <button onClick={() => setAddMode(null)} className="px-3 py-2 text-sm text-mc-text-secondary hover:text-mc-text">
              Anuluj
            </button>
          </div>
        </div>
      )}

      {/* Note form */}
      {addMode === 'note' && (
        <div className="p-4 bg-mc-bg rounded-lg border border-mc-border space-y-3">
          <input
            type="text"
            placeholder="Tytuł notatki *"
            value={noteForm.title}
            onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
            className="w-full bg-mc-bg-secondary border border-mc-border rounded px-3 py-2 text-sm focus:outline-none focus:border-mc-accent"
          />
          <textarea
            placeholder="Treść notatki *"
            value={noteForm.content}
            onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
            rows={5}
            className="w-full bg-mc-bg-secondary border border-mc-border rounded px-3 py-2 text-sm focus:outline-none focus:border-mc-accent resize-y font-mono"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAddNote}
              disabled={!noteForm.title || !noteForm.content}
              className="flex items-center gap-1.5 px-4 py-2 bg-mc-accent text-mc-bg rounded text-sm font-medium disabled:opacity-40"
            >
              <Plus className="w-4 h-4" /> Zapisz
            </button>
            <button onClick={() => setAddMode(null)} className="px-3 py-2 text-sm text-mc-text-secondary hover:text-mc-text">
              Anuluj
            </button>
          </div>
        </div>
      )}

      {/* Attachment list */}
      {attachments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-mc-text-secondary">
          <Paperclip className="w-10 h-10 mb-2 opacity-30" />
          <p className="text-sm">Brak dokumentów. Dodaj pliki, linki lub notatki do sprawy.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {attachments.map((att) => (
            <div key={att.id} className="rounded-lg border border-mc-border bg-mc-bg overflow-hidden">
              <div className="flex items-center gap-3 px-3 py-2.5">
                {/* Icon */}
                <div className="flex-shrink-0">
                  {att.attachment_type === 'link' && <LinkIcon className="w-5 h-5 text-mc-accent" />}
                  {att.attachment_type === 'note' && <StickyNote className="w-5 h-5 text-yellow-400" />}
                  {att.attachment_type === 'file' && getMimeIcon(att.file_mime, att.file_name)}
                </div>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {att.attachment_type === 'link' ? (
                      <a
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-mc-accent hover:underline text-sm flex items-center gap-1"
                      >
                        {att.title}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="font-medium text-sm text-mc-text truncate">{att.title}</span>
                    )}
                    <span className="text-xs px-1.5 py-0.5 rounded bg-mc-bg-tertiary text-mc-text-secondary capitalize">
                      {att.attachment_type === 'file' ? 'plik' : att.attachment_type === 'link' ? 'link' : 'notatka'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-mc-text-secondary">
                    {att.attachment_type === 'file' && att.file_size && <span>{formatBytes(att.file_size)}</span>}
                    {att.attachment_type === 'link' && att.url && (
                      <span className="truncate max-w-[200px]">{att.url}</span>
                    )}
                    {att.description && <span className="truncate max-w-[160px]">{att.description}</span>}
                    <span>{formatDate(att.created_at)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {att.attachment_type === 'note' && (
                    <button
                      onClick={() => setExpandedNote(expandedNote === att.id ? null : att.id)}
                      className="p-1.5 hover:bg-mc-bg-tertiary rounded text-mc-text-secondary"
                      title="Pokaż treść"
                    >
                      {expandedNote === att.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  )}
                  {att.attachment_type === 'file' && att.file_path && (
                    <button
                      onClick={() => handleDownload(att)}
                      className="p-1.5 hover:bg-mc-bg-tertiary rounded text-mc-accent"
                      title="Pobierz"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(att)}
                    className="p-1.5 hover:bg-mc-accent-red/10 rounded text-mc-accent-red"
                    title="Usuń"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Note expanded content */}
              {att.attachment_type === 'note' && expandedNote === att.id && att.content && (
                <div className="px-3 pb-3 border-t border-mc-border mt-0">
                  <pre className="text-xs text-mc-text-secondary whitespace-pre-wrap font-mono bg-mc-bg-tertiary rounded p-3 mt-2">
                    {att.content}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
